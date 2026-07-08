import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { isPodReady, podPhase } from "@/lib/kube/kubectl/format";
import { KubeSimulator } from "@/lib/kube/simulator";
import { runValidators } from "@/lib/kube/validators";

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

function joinDocs(docs: string[]): string {
  return docs.filter((d) => d.trim() !== "").join("\n---\n");
}

describe("Broken Readiness Probe — full solve path", () => {
  let sim: KubeSimulator | undefined;
  afterEach(async () => {
    await sim?.close();
    sim = undefined;
  });

  it("fails validation while broken, passes after fixing the probe path", async () => {
    const level = getLevelBySlug("broken-readiness-probe");
    expect(level).toBeDefined();
    if (!level) return;

    sim = new KubeSimulator();
    expect((await sim.boot()).ok).toBe(true);

    // Apply the initial (broken) state: Service + Deployment with readinessProbe /readyz.
    const broken = joinDocs([...level.initialManifests, ...level.files.map((f) => f.initialValue)]);
    expect((await sim.applyYaml(broken)).ok).toBe(true);

    // A pod comes up Running but never Ready → the Service gets no endpoints.
    await waitFor(() =>
      sim!.getSnapshot().pods.some((p) => podPhase(p) === "Running" && !isPodReady(p)),
    );
    expect((await runValidators(level.validators, { simulator: sim })).passed).toBe(false);

    // Fix: point the readiness probe at /healthz (what the app actually serves).
    const fixedFile = level.files[0]!.initialValue.replace("/readyz", "/healthz");
    expect((await sim.applyYaml(joinDocs([...level.initialManifests, fixedFile]))).ok).toBe(true);

    // Once a pod passes readiness, the Service gets an endpoint and every validator passes.
    let report = await runValidators(level.validators, { simulator: sim });
    const start = Date.now();
    while (!report.passed && Date.now() - start < 45000) {
      await new Promise((r) => setTimeout(r, 500));
      report = await runValidators(level.validators, { simulator: sim });
    }

    if (!report.passed) {
      const failing = report.results.filter((r) => !r.passed).map((r) => `${r.title}: ${r.detail}`);
      throw new Error(`Validation did not pass after fix. Failing: ${failing.join(" | ")}`);
    }
    expect(report.passed).toBe(true);
  });
});
