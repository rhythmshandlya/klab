import { afterEach, describe, expect, it } from "vitest";

import { LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { podRestarts } from "@/lib/kube/kubectl/format";
import { KubeSimulator, type ClusterSnapshot } from "@/lib/kube/simulator";
import { runValidators, type ValidationReport } from "@/lib/kube/validators";

/**
 * Solvability proof for EVERY level in the catalog: boot a real Webernetes cluster,
 * apply the level's broken starting state, assert its validators fail; then apply the
 * canonical solution (content/levels/solutions.ts) and assert the validators pass.
 * A level that can't red→green here never ships.
 */

const PER_LEVEL_TIMEOUT = 120_000;

function joinDocs(docs: string[]): string {
  return docs.filter((d) => d.trim() !== "").join("\n---\n");
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  stepMs = 100,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return predicate();
}

function readyPods(snapshot: ClusterSnapshot, labels: Record<string, string>): number {
  return snapshot.pods.filter(
    (p) =>
      Object.entries(labels).every(([k, v]) => p.metadata?.labels?.[k] === v) &&
      (p.status?.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True"),
  ).length;
}

function existingPods(snapshot: ClusterSnapshot, labels: Record<string, string>): number {
  return snapshot.pods.filter((p) =>
    Object.entries(labels).every(([k, v]) => p.metadata?.labels?.[k] === v),
  ).length;
}

function anyRestarts(snapshot: ClusterSnapshot, labels: Record<string, string>): boolean {
  return snapshot.pods.some(
    (p) =>
      Object.entries(labels).every(([k, v]) => p.metadata?.labels?.[k] === v) &&
      podRestarts(p) > 0,
  );
}

/**
 * Per-level predicate: "the broken state has fully materialized". Guards the
 * broken-must-fail assertion against booting-transients (e.g. before the zombie pod
 * exists, its no-pods-matching validator would transiently pass).
 */
const BROKEN_STATE_READY: Record<string, (s: ClusterSnapshot) => boolean> = {
  "service-selector-mismatch": (s) => readyPods(s, { app: "web-app" }) >= 2,
  "port-routing-bug": (s) => readyPods(s, { app: "web-app" }) >= 2,
  "broken-readiness-probe": (s) => existingPods(s, { app: "web-app" }) >= 1,
  "namespace-confusion": (s) => readyPods(s, { app: "storefront" }) >= 1,
  "service-has-no-endpoints": (s) =>
    s.deployments.some((d) => d.metadata?.name === "web-app"),
  "pod-crashloop-mystery": (s) => anyRestarts(s, { app: "queue-worker" }),
  "rolling-update-gone-wrong": (s) => existingPods(s, { app: "web-app" }) >= 2,
  "dns-resolution-failure": (s) => readyPods(s, { app: "orders-api" }) >= 1,
  "liveness-probe-death-spiral": (s) => anyRestarts(s, { app: "web-app" }),
  "config-drift": (s) => existingPods(s, { app: "web-app" }) >= 2,
  "broken-service-chain": (s) =>
    readyPods(s, { app: "web-app" }) >= 2 &&
    readyPods(s, { app: "orders-api" }) >= 1 &&
    readyPods(s, { app: "frontend" }) >= 1,
  "zombie-replicaset": (s) =>
    readyPods(s, { app: "web", track: "stable" }) >= 2 &&
    readyPods(s, { app: "web", track: "legacy" }) >= 1,
};

function brokenFiles(level: ProblemLevel): string[] {
  return level.files.map((f) => f.initialValue);
}

function describeReport(report: ValidationReport): string {
  return report.results
    .map((r) => `  [${r.passed ? "PASS" : "FAIL"}] ${r.title}: ${r.detail}`)
    .join("\n");
}

describe("level solvability (real Webernetes boot per level)", () => {
  let sim: KubeSimulator | undefined;

  afterEach(async () => {
    await sim?.close();
    sim = undefined;
  });

  for (const level of LEVELS) {
    const solution = LEVEL_SOLUTIONS[level.slug];

    it(
      `${level.slug}: broken state fails validation, canonical fix passes`,
      { timeout: PER_LEVEL_TIMEOUT },
      async () => {
        expect(solution, `level ${level.slug} is missing an entry in solutions.ts`).toBeDefined();
        const brokenReady = BROKEN_STATE_READY[level.slug];
        expect(
          brokenReady,
          `level ${level.slug} is missing a broken-state predicate in this test`,
        ).toBeDefined();

        sim = new KubeSimulator();
        const booted = await sim.boot();
        expect(booted.ok, booted.ok ? "" : (booted as { error: string }).error).toBe(true);

        // Broken starting state: exactly what the workspace applies on level load.
        const appliedBroken = await sim.applyYaml(
          joinDocs([...level.initialManifests, ...brokenFiles(level)]),
        );
        expect(
          appliedBroken.ok,
          appliedBroken.ok ? "" : `broken apply failed: ${(appliedBroken as { error: string }).error}`,
        ).toBe(true);

        const materialized = await waitFor(() => brokenReady!(sim!.getSnapshot()), 60_000);
        expect(materialized, `broken state never materialized for ${level.slug}`).toBe(true);

        const brokenReport = await runValidators(level.validators, { simulator: sim });
        expect(
          brokenReport.passed,
          `broken state unexpectedly PASSED for ${level.slug}:\n${describeReport(brokenReport)}`,
        ).toBe(false);

        // Canonical fix (same path a learner takes: re-apply initial manifests + edited files).
        const appliedFix = await sim.applyYaml(
          joinDocs([...level.initialManifests, ...Object.values(solution!.files)]),
        );
        expect(
          appliedFix.ok,
          appliedFix.ok ? "" : `fix apply failed: ${(appliedFix as { error: string }).error}`,
        ).toBe(true);

        const deadline = Date.now() + 60_000;
        let finalReport = await runValidators(level.validators, { simulator: sim });
        while (!finalReport.passed && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          finalReport = await runValidators(level.validators, { simulator: sim });
        }
        expect(
          finalReport.passed,
          `fix (${solution!.fix}) did not pass for ${level.slug}:\n${describeReport(finalReport)}`,
        ).toBe(true);
      },
    );
  }
});
