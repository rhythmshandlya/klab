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

describe("Problems 41–44 acceptance regressions", () => {
  it("requires the full collector budget without allowing workload replacement", () => {
    const { problem, files } = solved("logging-agent-system-oom");
    expect(failures(problem, files)).toEqual([]);
    files["log-collector.yaml"] = files["log-collector.yaml"]!.replace(
      "              memory: 256Mi\n",
      "",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("preserves the queue worker's existing resource reservations", () => {
    const { problem, files } = solved("diskpressure-runaway-logs");
    expect(failures(problem, files)).toEqual([]);
    files["worker-deployment.yaml"] = files["worker-deployment.yaml"]!.replace(
      "              cpu: 200m\n",
      "",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("preserves the catalog workload identity and limits while adding HPA inputs", () => {
    const { problem, files } = solved("hpa-cannot-compute-replicas");
    expect(failures(problem, files)).toEqual([]);
    files["api-deployment.yaml"] = files["api-deployment.yaml"]!.replace(
      "              memory: 512Mi",
      "              memory: 1Gi",
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });

  it("rejects an extra whole-Pod metric that can reintroduce the sidecar signal", () => {
    const { problem, files } = solved("sidecar-poisons-scaling-signal");
    expect(failures(problem, files)).toEqual([]);
    files["orders-hpa.yaml"] +=
      `\n# A second aggregate metric would again let the sidecar drive scale.\n`;
    files["orders-hpa.yaml"] = files["orders-hpa.yaml"]!.replace(
      "          averageUtilization: 65",
      `          averageUtilization: 65
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65`,
    );
    expect(failures(problem, files)).toContain("constraint:production-requirements");
  });
});

describe("Problems 41–44 fixture fidelity", () => {
  it("shows the HPA metric failure before repair and a valid metric afterward", async () => {
    const { problem, files } = solved("hpa-cannot-compute-replicas");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      const before = engine
        .getSnapshot()
        .resources?.find((item) => item.kind === "HorizontalPodAutoscaler");
      expect(JSON.stringify(before?.status)).toContain("FailedGetResourceMetric");

      expect((await engine.applyFiles(files)).ok).toBe(true);
      const after = engine
        .getSnapshot()
        .resources?.find((item) => item.kind === "HorizontalPodAutoscaler");
      expect(JSON.stringify(after?.status)).toContain("ValidMetricFound");
    } finally {
      await engine.close();
    }
  });

  it("exposes both application and sidecar containers for the skewed scaling incident", async () => {
    const { problem } = solved("sidecar-poisons-scaling-signal");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      expect(
        engine.getSnapshot().pods[0]?.spec?.containers.map((container) => container.name),
      ).toEqual(["api", "metrics"]);
    } finally {
      await engine.close();
    }
  });
});
