import { afterEach, describe, expect, it } from "vitest";

import { LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { podRestarts } from "@/lib/kube/kubectl/format";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { ValidationReport } from "@/lib/kube/validators";

/**
 * Solvability proof for EVERY level in the catalog: boot a real Webernetes cluster,
 * apply the level's broken starting state, assert its validators fail; then apply the
 * canonical solution (content/levels/solutions.ts) and assert the validators pass.
 * A level that can't red→green here never ships.
 */

const PER_LEVEL_TIMEOUT = 120_000;

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
      Object.entries(labels).every(([k, v]) => p.metadata?.labels?.[k] === v) && podRestarts(p) > 0,
  );
}

function podsUsingImage(snapshot: ClusterSnapshot, image: string): number {
  return snapshot.pods.filter((pod) =>
    (pod.spec?.containers ?? []).some((container) => container.image === image),
  ).length;
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
  "command-override-crash": (s) => anyRestarts(s, { app: "storefront" }),
  "service-has-no-endpoints": (s) => s.deployments.some((d) => d.metadata?.name === "web-app"),
  "pod-crashloop-mystery": (s) => anyRestarts(s, { app: "queue-worker" }),
  "private-registry-pull-secret": (s) =>
    s.pods.some(
      (pod) => pod.metadata?.labels?.app === "private-api" && pod.status?.phase === "Pending",
    ),
  "rolling-update-gone-wrong": (s) =>
    s.replicaSets.filter((replicaSet) => replicaSet.metadata?.name?.startsWith("web-app-"))
      .length >= 2 && podsUsingImage(s, "klab/web-app:2.0.0") >= 1,
  "dns-resolution-failure": (s) => readyPods(s, { app: "orders-api" }) >= 1,
  "slow-start-without-startup-probe": (s) => anyRestarts(s, { app: "reports-api" }),
  "probe-hits-wrong-port": (s) => existingPods(s, { app: "payments-api" }) >= 2,
  "liveness-probe-death-spiral": (s) => anyRestarts(s, { app: "web-app" }),
  "config-drift": (s) => existingPods(s, { app: "web-app" }) >= 2,
  "broken-service-chain": (s) =>
    readyPods(s, { app: "web-app" }) >= 2 &&
    readyPods(s, { app: "orders-api" }) >= 1 &&
    readyPods(s, { app: "frontend" }) >= 1,
  "healthy-app-broken-sidecar": (s) => anyRestarts(s, { app: "checkout" }),
  "graceful-shutdown-502s": (s) =>
    s.pods.some((pod) => pod.metadata?.name === "edge-api-old" && pod.metadata.deletionTimestamp),
  "recreate-strategy-outage": (s) =>
    s.deployments.some(
      (d) => d.metadata?.name === "checkout" && (d.status?.readyReplicas ?? 0) === 0,
    ),
  "rollout-cannot-fit-maxsurge": (s) =>
    s.pods.some(
      (pod) => pod.metadata?.labels?.app === "analytics" && pod.status?.phase === "Pending",
    ),
  "immutable-deployment-selector": (s) =>
    readyPods(s, { app: "search" }) >= 2 &&
    (
      s.endpointSlices.find(
        (es) => es.metadata?.labels?.["kubernetes.io/service-name"] === "search-svc",
      )?.endpoints ?? []
    ).length === 0,
  "zombie-replicaset": (s) =>
    readyPods(s, { app: "web", track: "stable" }) >= 2 &&
    readyPods(s, { app: "web", track: "legacy" }) >= 1,
};

function workspaceFiles(level: ProblemLevel): Record<string, string> {
  return Object.fromEntries(
    level.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function describeReport(report: ValidationReport): string {
  return report.results
    .map(
      (r) =>
        `  [${r.passed ? "PASS" : "FAIL"}] ${r.title}: ${r.detail}${
          r.diagnostic ? `\n${r.diagnostic.replace(/^/gm, "      ")}` : ""
        }`,
    )
    .join("\n");
}

describe("level solvability (real Webernetes boot per level)", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  for (const level of LEVELS) {
    const solution = LEVEL_SOLUTIONS[level.slug];

    it(
      `${level.slug}: broken state fails validation, canonical fix passes`,
      { timeout: PER_LEVEL_TIMEOUT },
      async () => {
        expect(solution, `level ${level.slug} is missing an entry in solutions.ts`).toBeDefined();
        const brokenReady =
          BROKEN_STATE_READY[level.slug] ??
          (level.engine.kind === "scripted" && level.engine.scenarioId === "manifest-assessment"
            ? (snapshot: ClusterSnapshot) =>
                snapshot.pods.some((pod) => pod.metadata?.name === "manifest-assessment")
            : // A fixture renders synchronously, and policy/storage/control-plane
              // incidents may intentionally have no modelled Pods. The authored
              // incident event is the common proof that the broken state exists.
              level.engine.kind === "fixture"
              ? (snapshot: ClusterSnapshot) => snapshot.events.length > 0
              : undefined);
        expect(
          brokenReady,
          `level ${level.slug} is missing a broken-state predicate in this test`,
        ).toBeDefined();

        engine = createProblemEngine(level.engine);
        const booted = await engine.boot(level);
        expect(booted.ok, booted.ok ? "" : (booted as { error: string }).error).toBe(true);

        const materialized = await waitFor(() => brokenReady!(engine!.getSnapshot()), 60_000);
        expect(materialized, `broken state never materialized for ${level.slug}`).toBe(true);

        const currentFiles = workspaceFiles(level);
        const brokenReport = await engine.validate(level, currentFiles);
        expect(
          brokenReport.passed,
          `broken state unexpectedly PASSED for ${level.slug}:\n${describeReport(brokenReport)}`,
        ).toBe(false);

        // Canonical fix follows the learner path: only changed editable files are re-applied.
        const appliedFix = await engine.applyFiles(solution!.files);
        expect(
          appliedFix.ok,
          appliedFix.ok ? "" : `fix apply failed: ${(appliedFix as { error: string }).error}`,
        ).toBe(true);

        const deadline = Date.now() + 60_000;
        const solvedFiles = { ...currentFiles, ...solution!.files };
        let finalReport = await engine.validate(level, solvedFiles);
        while (!finalReport.passed && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          finalReport = await engine.validate(level, solvedFiles);
        }
        expect(
          finalReport.passed,
          `fix (${solution!.fix}) did not pass for ${level.slug}:\n${describeReport(finalReport)}`,
        ).toBe(true);
      },
    );
  }
});
