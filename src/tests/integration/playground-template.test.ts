import { afterEach, describe, expect, it } from "vitest";

import { getTemplateById } from "@/content/playground-templates";
import { isPodReady, podPhase } from "@/lib/kube/kubectl/format";
import { runCommandLine } from "@/lib/kube/command-runner";
import { KubeSimulator } from "@/lib/kube/simulator";

function joinDocs(docs: string[]): string {
  return docs.filter((d) => d.trim() !== "").join("\n---\n");
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 25000,
  stepMs = 250,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return predicate();
}

describe("Playground: Deployment + Service template", () => {
  let sim: KubeSimulator | undefined;
  afterEach(async () => {
    await sim?.close();
    sim = undefined;
  });

  it("applies the template, reconciles ready pods, and stays stable (no churn)", async () => {
    const template = getTemplateById("deployment-service");
    expect(template).toBeDefined();
    if (!template) return;

    sim = new KubeSimulator();
    expect((await sim.boot()).ok).toBe(true);
    expect((await sim.applyYaml(joinDocs(template.files.map((f) => f.initialValue)))).ok).toBe(
      true,
    );

    const appPods = () =>
      sim!.getSnapshot().pods.filter((p) => p.metadata?.labels?.["app"] === "webapp");

    // Pods become Ready (healthy template).
    const ready = await waitFor(() =>
      appPods().some((p) => isPodReady(p) && podPhase(p) === "Running"),
    );
    expect(ready).toBe(true);

    // Healthy Deployment must NOT churn: the pod count stays bounded.
    await new Promise((r) => setTimeout(r, 8000));
    expect(appPods().length).toBeLessThanOrEqual(3);

    // Observable via kubectl.
    const ctx = { simulator: sim, namespace: "default", files: {} };
    const getPods = await runCommandLine("kubectl get pods", ctx);
    expect(getPods.output).toContain("webapp");
    const getSvc = await runCommandLine("kubectl get svc", ctx);
    expect(getSvc.output).toContain("webapp-svc");

    // Scaling replicas 2 -> 3 reconciles to three ready pods (the example flow).
    const scaled = template.files.map((f) => f.initialValue.replace("replicas: 2", "replicas: 3"));
    expect((await sim.applyYaml(joinDocs(scaled))).ok).toBe(true);
    const three = await waitFor(() => appPods().filter(isPodReady).length >= 3, 30000);
    expect(three).toBe(true);
  });
});
