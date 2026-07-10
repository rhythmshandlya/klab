import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { runCommandLine } from "@/lib/kube/command-runner";
import { applyProblemBoot } from "@/lib/kube/problem-boot";
import { KubeSimulator } from "@/lib/kube/simulator";
import { runLevelValidation } from "@/lib/kube/validators";

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 45_000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return predicate();
}

describe("Rolling Update Gone Wrong staged incident", () => {
  let simulator: KubeSimulator | undefined;

  afterEach(async () => {
    await simulator?.close();
    simulator = undefined;
  });

  it("materializes old/new ReplicaSets with bounded resources and recovers by rollback", async () => {
    const level = getLevelBySlug("rolling-update-gone-wrong")!;
    const solution = LEVEL_SOLUTIONS[level.slug]!;
    simulator = new KubeSimulator();
    expect((await simulator.boot()).ok).toBe(true);
    const booted = await applyProblemBoot(simulator, level);
    expect(booted.ok, booted.ok ? "" : booted.error).toBe(true);

    const snapshot = simulator.getSnapshot();
    const rolloutSets = snapshot.replicaSets.filter((replicaSet) =>
      replicaSet.metadata?.name?.startsWith("web-app-"),
    );
    const images = new Set(
      rolloutSets.flatMap((replicaSet) =>
        (replicaSet.spec?.template?.spec?.containers ?? []).map((container) => container.image),
      ),
    );
    expect(images).toContain("klab/web-app:1.0.0");
    expect(images).toContain("klab/web-app:2.0.0");
    expect(rolloutSets.length).toBeGreaterThanOrEqual(2);
    expect(rolloutSets.length).toBeLessThanOrEqual(3);
    expect(
      snapshot.pods.filter((pod) => pod.metadata?.labels?.app === "web-app").length,
    ).toBeLessThanOrEqual(4);

    const command = await runCommandLine("kubectl get rs", {
      simulator,
      namespace: "default",
      files: {},
    });
    expect(command.isError).toBe(false);
    expect((command.output.match(/web-app-/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const currentFiles = Object.fromEntries(
      level.files
        .filter((file) => file.access !== "hidden")
        .map((file) => [file.path, file.initialValue]),
    );
    expect((await runLevelValidation(level, currentFiles, { simulator })).passed).toBe(false);

    expect((await simulator.applyYaml(solution.files["deployment.yaml"]!)).ok).toBe(true);
    const solvedFiles = { ...currentFiles, ...solution.files };
    const stable = await waitFor(
      async () => (await runLevelValidation(level, solvedFiles, { simulator: simulator! })).passed,
    );
    expect(stable).toBe(true);
  });
});
