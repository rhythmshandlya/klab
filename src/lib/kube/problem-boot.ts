import type { ProblemBootStep, ProblemBootWait } from "@/lib/domain/types";
import { err, ok, type Result } from "@/lib/utils/result";

import { isPodReady } from "./kubectl/format";
import type { AppliedResourceRef, ClusterSnapshot, KubeSimulator } from "./simulator";

export interface ProblemBootSpec {
  files: ReadonlyArray<{
    path?: string;
    initialValue: string;
    applyAtBoot?: boolean;
  }>;
  initialManifests?: string[];
  bootSequence?: ProblemBootStep[];
}

function joinDocs(docs: readonly string[]): string {
  return docs.filter((document) => document.trim() !== "").join("\n---\n");
}

export async function applyProblemBoot(
  simulator: KubeSimulator,
  spec: ProblemBootSpec,
): Promise<Result<AppliedResourceRef[], string>> {
  if (!spec.bootSequence) {
    return simulator.applyYaml(
      joinDocs([
        ...(spec.initialManifests ?? []),
        ...spec.files.filter((file) => file.applyAtBoot !== false).map((file) => file.initialValue),
      ]),
    );
  }

  const filesByPath = new Map(
    spec.files.filter((file) => file.path).map((file) => [file.path!, file.initialValue]),
  );
  const applied: AppliedResourceRef[] = [];
  for (const step of spec.bootSequence) {
    const missing = step.filePaths.filter((path) => !filesByPath.has(path));
    if (missing.length > 0) {
      return err(`Boot step ${step.id} references missing file(s): ${missing.join(", ")}`);
    }
    const result = await simulator.applyYaml(
      joinDocs(step.filePaths.map((path) => filesByPath.get(path) ?? "")),
    );
    if (!result.ok) return err(`Boot step ${step.id} failed: ${result.error}`);
    applied.push(...result.value);
    if (step.waitFor) {
      const settled = await waitForCondition(simulator, step.waitFor);
      if (!settled) return err(`Boot step ${step.id} timed out waiting for ${step.waitFor.kind}`);
    }
  }
  return ok(applied);
}

async function waitForCondition(
  simulator: KubeSimulator,
  condition: ProblemBootWait,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < condition.timeoutMs) {
    if (conditionSatisfied(simulator.getSnapshot(), condition)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return conditionSatisfied(simulator.getSnapshot(), condition);
}

function conditionSatisfied(snapshot: ClusterSnapshot, condition: ProblemBootWait): boolean {
  const matchingPods = snapshot.pods.filter(
    (pod) => (pod.metadata?.namespace ?? "default") === condition.namespace,
  );
  if (condition.kind === "pods-ready") {
    return (
      matchingPods.filter(
        (pod) =>
          isPodReady(pod) &&
          Object.entries(condition.selector).every(
            ([key, value]) => pod.metadata?.labels?.[key] === value,
          ),
      ).length >= condition.minReady
    );
  }
  return (
    matchingPods.filter((pod) =>
      (pod.spec?.containers ?? []).some((container) => container.image === condition.image),
    ).length >= condition.minCount
  );
}
