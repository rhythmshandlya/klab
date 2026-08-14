import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { createProblemEngine } from "@/lib/kube/problem-engine";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

function solved(slug: string): { problem: ProblemLevel; files: Record<string, string> } {
  const problem = getLevelBySlug(slug);
  if (!problem) throw new Error(`Unknown level ${slug}`);
  const files = Object.fromEntries(
    problem.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
  return { problem, files: { ...files, ...LEVEL_SOLUTIONS[slug]!.files } };
}

function failures(problem: ProblemLevel, files: Record<string, string>): string[] {
  return evaluateLevelConstraints(problem, files)
    .filter((result) => !result.passed)
    .map((result) => result.id);
}

describe("Problems 45–48 acceptance regressions", () => {
  it("rejects unbounded or contradictory additions to the flash-sale design", () => {
    const { problem, files } = solved("build-flash-sale-scaling-system");
    expect(failures(problem, files)).toEqual([]);
    expect(evaluateWorkspaceSemantics(problem, files)).toEqual([]);

    files["api-hpa.yaml"] = files["api-hpa.yaml"]!.replace(
      "  metrics:\n    - type: Resource",
      `  metrics:
    - type: Pods
      pods:
        metric:
          name: arbitrary_signal
        target:
          type: AverageValue
          averageValue: "1"
    - type: Resource`,
    );
    expect(failures(problem, files)).toContain("constraint:architecture-api-hpa-yaml");
  });

  it("accepts either numeric or named checkout target ports", () => {
    const { problem, files } = solved("ten-percent-pods-all-traffic");
    files["checkout-service.yaml"] = files["checkout-service.yaml"]!.replace(
      "targetPort: 8080",
      "targetPort: http",
    );
    expect(failures(problem, files)).toEqual([]);
  });

  it("accepts equivalent PDB syntax but rejects a zero-disruption budget", () => {
    const { problem, files } = solved("pdb-makes-drain-impossible");
    files["ledger-pdb.yaml"] = files["ledger-pdb.yaml"]!.replace(
      "minAvailable: 2",
      "maxUnavailable: 1",
    );
    expect(failures(problem, files)).toEqual([]);

    files["ledger-pdb.yaml"] = files["ledger-pdb.yaml"]!.replace(
      "maxUnavailable: 1",
      "minAvailable: 3",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("preserves the pricing rollout identity while adding the stability gate", () => {
    const { problem, files } = solved("delayed-crash-escapes-rollout-gate");
    expect(failures(problem, files)).toEqual([]);
    files["pricing-deployment.yaml"] = files["pricing-deployment.yaml"]!.replace(
      "registry.example/pricing:v4",
      "registry.example/no-op:v4",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });
});

describe("Problems 46 and 48 fixture fidelity", () => {
  it("expands checkout endpoints from the one canary to all ten Ready Pods", async () => {
    const { problem, files } = solved("ten-percent-pods-all-traffic");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      const readyEndpoints = () =>
        engine
          .getSnapshot()
          .endpointSlices.flatMap((slice) => slice.endpoints ?? [])
          .filter((endpoint) => endpoint.conditions?.ready).length;
      expect(readyEndpoints()).toBe(1);
      expect((await engine.applyFiles(files)).ok).toBe(true);
      expect(readyEndpoints()).toBe(10);
    } finally {
      await engine.close();
    }
  });

  it("keeps stable v3 replicas when the gated v4 replica crashes", async () => {
    const { problem, files } = solved("delayed-crash-escapes-rollout-gate");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(
        engine.getSnapshot().pods.filter((pod) => pod.status?.containerStatuses?.[0]?.ready),
      ).toHaveLength(0);

      expect((await engine.applyFiles(files)).ok).toBe(true);
      const after = engine.getSnapshot();
      expect(after.pods.filter((pod) => pod.metadata?.labels?.version === "v3")).toHaveLength(3);
      expect(
        after.pods.find((pod) => pod.metadata?.labels?.version === "v4")?.status
          ?.containerStatuses?.[0]?.state?.waiting?.reason,
      ).toBe("CrashLoopBackOff");
    } finally {
      await engine.close();
    }
  });
});
