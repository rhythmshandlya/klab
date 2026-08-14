import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { runCommandLine } from "@/lib/kube/command-runner";
import { createProbeSignal, matchEvidence, type InvestigationSignal } from "@/lib/kube/evidence";
import { isPodReady, podPhase } from "@/lib/kube/kubectl/format";
import { applyProblemBoot } from "@/lib/kube/problem-boot";
import { KubeSimulator } from "@/lib/kube/simulator";
import { runLevelValidation } from "@/lib/kube/validators";

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

describe("Broken Readiness Probe: full solve path", () => {
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

    // Apply the initial (broken) state: Service + Pod with readinessProbe /readyz.
    expect((await applyProblemBoot(sim, level)).ok).toBe(true);

    // A pod comes up Running but never Ready → the Service gets no endpoints.
    expect(
      await waitFor(() =>
        sim!.getSnapshot().pods.some((p) => podPhase(p) === "Running" && !isPodReady(p)),
      ),
    ).toBe(true);
    const brokenFiles = Object.fromEntries(
      level.files
        .filter((file) => file.access !== "hidden")
        .map((file) => [file.path, file.initialValue]),
    );
    expect((await runLevelValidation(level, brokenFiles, { simulator: sim })).passed).toBe(false);

    // Every authored clue must be observable before the fix. In particular, requests
    // cannot reach /readyz through a Service that refuses to route to the NotReady Pod.
    const failureObserved = await waitFor(() =>
      sim!
        .getSnapshot()
        .events.some(
          (event) =>
            event.reason === "Unhealthy" &&
            /Readiness probe failed.*statuscode: 404/i.test(event.message ?? ""),
        ),
    );
    expect(failureObserved).toBe(true);
    const brokenSnapshot = sim.getSnapshot();
    const podName = brokenSnapshot.pods.find((pod) => pod.metadata?.labels?.app === "web-app")
      ?.metadata?.name;
    expect(podName).toBeDefined();
    const described = await runCommandLine(`kubectl describe pod ${podName}`, {
      simulator: sim,
      namespace: "default",
      files: brokenFiles,
    });
    const serviceDescribed = await runCommandLine("kubectl describe svc web-svc", {
      simulator: sim,
      namespace: "default",
      files: brokenFiles,
    });
    const serviceProbe = await sim.probe("http://web-svc/");
    const evidenceSignals: InvestigationSignal[] = [
      ...described.signals,
      ...serviceDescribed.signals,
      createProbeSignal("http://web-svc/", serviceProbe),
      ...brokenSnapshot.events.map((event) => ({
        type: "event-reason" as const,
        reason: event.reason ?? "",
        message: event.message ?? "",
        namespace: event.metadata?.namespace ?? "default",
      })),
    ];
    expect(matchEvidence(level.evidenceRules, evidenceSignals)).toEqual(
      expect.arrayContaining([
        "readyz-404",
        "probe-paths",
        "svc-no-endpoints",
        "service-unavailable",
      ]),
    );

    // Fix: point the readiness probe at /healthz (what the app actually serves).
    const fixedFile = level.files[0]!.initialValue.replace("/readyz", "/healthz");
    expect((await sim.applyYaml(fixedFile)).ok).toBe(true);

    // Once a pod passes readiness, the Service gets an endpoint and every validator passes.
    const fixedFiles = { ...brokenFiles, [level.files[0]!.path]: fixedFile };
    let report = await runLevelValidation(level, fixedFiles, { simulator: sim });
    const start = Date.now();
    while (!report.passed && Date.now() - start < 45000) {
      await new Promise((r) => setTimeout(r, 500));
      report = await runLevelValidation(level, fixedFiles, { simulator: sim });
    }

    if (!report.passed) {
      const failing = report.results
        .filter((r) => !r.passed)
        .map((r) => `${r.title}: ${r.detail}${r.diagnostic ? ` (${r.diagnostic})` : ""}`);
      throw new Error(`Validation did not pass after fix. Failing: ${failing.join(" | ")}`);
    }
    expect(report.passed).toBe(true);
  });
});
