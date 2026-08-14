import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { createProblemEngine } from "@/lib/kube/problem-engine";

function level(slug: string): ProblemLevel {
  const value = getLevelBySlug(slug);
  if (!value) throw new Error(`Unknown level ${slug}`);
  return value;
}

function workspace(problem: ProblemLevel): Record<string, string> {
  return Object.fromEntries(
    problem.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function failures(problem: ProblemLevel, files: Readonly<Record<string, string>>): string[] {
  return evaluateLevelConstraints(problem, files)
    .filter((result) => !result.passed)
    .map((result) => result.id);
}

describe("Problems 25, 26, and 28 acceptance contracts", () => {
  it("keeps the CoreDNS workload identity while restoring exactly three replicas", () => {
    const problem = level("conntrack-ghost");
    const canonical = { ...workspace(problem), ...LEVEL_SOLUTIONS[problem.slug]!.files };
    expect(failures(problem, canonical)).toEqual([]);

    const changedImage = {
      ...canonical,
      "coredns-deployment.yaml": canonical["coredns-deployment.yaml"]!.replace(
        "registry.k8s.io/coredns/coredns:v1.12.0",
        "example.invalid/not-coredns:latest",
      ),
    };
    expect(failures(problem, changedImage)).toContain("constraint:production-requirements");
  });

  it("accepts the additional Pod range in any array position and preserves both primary ranges", () => {
    const problem = level("pod-ip-pool-exhausted");
    const canonical = { ...workspace(problem), ...LEVEL_SOLUTIONS[problem.slug]!.files };
    const reordered = {
      ...canonical,
      "container-cluster.yaml": canonical["container-cluster.yaml"]!.replace(
        "podRangeNames:\n        - pods-expansion-2026",
        "podRangeNames:\n        - pods-future\n        - pods-expansion-2026",
      ),
    };
    expect(failures(problem, reordered)).toEqual([]);

    const changedPrimary = {
      ...canonical,
      "container-cluster.yaml": canonical["container-cluster.yaml"]!.replace(
        "clusterSecondaryRangeName: pods-primary",
        "clusterSecondaryRangeName: pods-replacement",
      ),
    };
    expect(failures(problem, changedPrimary)).toContain("constraint:production-requirements");
  });

  it("does not accept ndots repair by replacing the telemetry workload", () => {
    const problem = level("ndots-retry-storm");
    const canonical = { ...workspace(problem), ...LEVEL_SOLUTIONS[problem.slug]!.files };
    expect(failures(problem, canonical)).toEqual([]);

    const changedImage = {
      ...canonical,
      "telemetry-daemonset.yaml": canonical["telemetry-daemonset.yaml"]!.replace(
        /registry\.example\/telemetry@sha256:[a-f0-9]+/,
        "example.invalid/no-op:latest",
      ),
    };
    expect(failures(problem, changedImage)).toContain("constraint:production-requirements");
  });
});

describe("Problem 26 fixture fidelity", () => {
  it("shows Pending sandbox failures before the fix and addressed Pods afterward", async () => {
    const problem = level("pod-ip-pool-exhausted");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(engine.getSnapshot().pods.every((pod) => pod.status?.phase === "Pending")).toBe(true);
      expect(
        engine.getSnapshot().events.some((event) => event.reason === "FailedCreatePodSandBox"),
      ).toBe(true);

      expect((await engine.applyFiles(LEVEL_SOLUTIONS[problem.slug]!.files)).ok).toBe(true);
      expect(engine.getSnapshot().pods.every((pod) => pod.status?.phase === "Running")).toBe(true);
      expect(engine.getSnapshot().pods.every((pod) => Boolean(pod.status?.podIP))).toBe(true);
    } finally {
      await engine.close();
    }
  });
});
