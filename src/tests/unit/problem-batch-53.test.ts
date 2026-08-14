import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { createProblemEngine } from "@/lib/kube/problem-engine";

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

describe("Problems 53–56 acceptance regressions", () => {
  it("drops only the intended unbounded metric label", () => {
    const { problem, files } = solved("prometheus-user-id-cardinality");
    expect(failures(problem, files)).toEqual([]);
    files["service-monitor.yaml"] = files["service-monitor.yaml"]!.replace(
      "          regex: user_id",
      "          regex: user_id|route",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("rejects disarming NOSPACE before space has been reclaimed", () => {
    const { problem, files } = solved("etcd-nospace-freezes-writes");
    expect(failures(problem, files)).toEqual([]);
    files["etcd-recovery-static-pod.yaml"] = files["etcd-recovery-static-pod.yaml"]!.replace(
      '          revision="$(etcdctl endpoint status',
      '          etcdctl alarm disarm\n          revision="$(etcdctl endpoint status',
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("preserves the exact control-plane version and thirty-day rotation window", () => {
    const { problem, files } = solved("certificates-expired-overnight");
    expect(failures(problem, files)).toEqual([]);
    files["control-plane.yaml"] = files["control-plane.yaml"]!.replace(
      "version: v1.36.0",
      "version: v1.35.0",
    ).replace("certificatesExpiryDays: 30", "certificatesExpiryDays: 365");
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("keeps the network-agent identity while applying the approved rollout", () => {
    const { problem, files } = solved("control-plane-upgrade-breaks-data-plane");
    expect(failures(problem, files)).toEqual([]);
    files["network-agent.yaml"] = files["network-agent.yaml"]!.replace(
      "        app: network-agent\n    spec:",
      "        app: unrelated-agent\n    spec:",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });
});

describe("Problems 53–56 fixture fidelity", () => {
  it("moves Prometheus from OOMKilled to a ready endpoint after relabeling", async () => {
    const { problem, files } = solved("prometheus-user-id-cardinality");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(
        engine.getSnapshot().pods[0]?.status?.containerStatuses?.[0]?.state?.waiting?.reason,
      ).toBe("CrashLoopBackOff");
      expect(
        engine.getSnapshot().pods[0]?.status?.containerStatuses?.[0]?.lastState?.terminated?.reason,
      ).toBe("OOMKilled");
      expect((await engine.applyFiles(files)).ok).toBe(true);
      expect(engine.getSnapshot().pods[0]?.status?.containerStatuses?.[0]?.ready).toBe(true);
      expect(
        engine
          .getSnapshot()
          .endpointSlices.flatMap((slice) => slice.endpoints ?? [])
          .some((endpoint) => endpoint.conditions?.ready),
      ).toBe(true);
    } finally {
      await engine.close();
    }
  });

  it("recovers the failed etcd maintenance attempt only after the safe sequence", async () => {
    const { problem, files } = solved("etcd-nospace-freezes-writes");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Failed");
      expect((await engine.applyFiles(files)).ok).toBe(true);
      expect(engine.getSnapshot().pods[0]?.status?.phase).toBe("Succeeded");
    } finally {
      await engine.close();
    }
  });

  it("restores the new-node network agent and the blocked application Pod", async () => {
    const { problem, files } = solved("control-plane-upgrade-breaks-data-plane");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(
        engine.getSnapshot().pods.find((pod) => pod.metadata?.name === "network-agent-new-node-1")
          ?.status?.containerStatuses?.[0]?.ready,
      ).toBe(false);
      expect((await engine.applyFiles(files)).ok).toBe(true);
      expect(engine.getSnapshot().pods.every((pod) => pod.status?.phase === "Running")).toBe(true);
    } finally {
      await engine.close();
    }
  });
});
