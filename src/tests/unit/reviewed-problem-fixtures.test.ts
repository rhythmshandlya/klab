import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { createProblemEngine } from "@/lib/kube/problem-engine";

function workspaceFiles(level: ProblemLevel): Record<string, string> {
  return Object.fromEntries(
    level.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

describe("reviewed problem fixture fidelity", () => {
  it("shows all checkout replicas in zone-a before repair and three zones afterward", async () => {
    const level = getLevelBySlug("all-replicas-one-failure-domain")!;
    const engine = createProblemEngine(level.engine);
    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const broken = engine.getSnapshot();
      const zonesByNode = new Map(
        broken.nodes.map((node) => [
          node.metadata?.name,
          node.metadata?.labels?.["topology.kubernetes.io/zone"],
        ]),
      );
      const brokenZones = broken.pods
        .filter((pod) => pod.metadata?.labels?.app === "checkout")
        .map((pod) => zonesByNode.get(pod.spec?.nodeName));
      expect(brokenZones).toEqual(["zone-a", "zone-a", "zone-a"]);

      const solution = LEVEL_SOLUTIONS[level.slug]!;
      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const healthy = engine.getSnapshot();
      const healthyZonesByNode = new Map(
        healthy.nodes.map((node) => [
          node.metadata?.name,
          node.metadata?.labels?.["topology.kubernetes.io/zone"],
        ]),
      );
      const healthyZones = healthy.pods
        .filter((pod) => pod.metadata?.labels?.app === "checkout")
        .map((pod) => healthyZonesByNode.get(pod.spec?.nodeName));
      expect(new Set(healthyZones)).toEqual(new Set(["zone-a", "zone-b", "zone-c"]));
      const report = await engine.validate(level, {
        ...workspaceFiles(level),
        ...solution.files,
      });
      expect(report.passed).toBe(true);
    } finally {
      await engine.close();
    }
  });

  it("exposes the priority chain and moves reporting behind the public API", async () => {
    const level = getLevelBySlug("priority-preemption-cascade")!;
    expect(level.engine.kind).toBe("fixture");
    if (level.engine.kind !== "fixture") return;
    expect(level.engine.fixture.broken.pods.map((pod) => pod.priorityClassName)).toEqual(
      Array.from({ length: 8 }, () => "platform-critical").concat([
        "customer-serving",
        "customer-serving",
      ]),
    );
    const engine = createProblemEngine(level.engine);
    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const files = workspaceFiles(level);
      const broken = engine.getSnapshot();
      expect(
        broken.resources?.filter((resource) => resource.kind === "PriorityClass"),
      ).toHaveLength(3);
      const brokenReportingClasses = broken.pods
        .filter((pod) => pod.metadata?.labels?.app === "reporting")
        .map((pod) => pod.spec?.priorityClassName);
      expect(brokenReportingClasses).toEqual(Array.from({ length: 8 }, () => "platform-critical"));
      expect(
        broken.pods
          .filter((pod) => pod.metadata?.labels?.app === "public-api")
          .every((pod) => pod.status?.phase === "Pending"),
      ).toBe(true);

      for (const command of [
        "kubectl get priorityclass",
        "kubectl describe priorityclass platform-critical",
        "kubectl describe priorityclass batch-low",
      ]) {
        const result = await engine.runCommand(command, "default", files);
        expect(result.isError, `${command}: ${result.output}`).toBe(false);
        expect(result.output).toMatch(/PriorityClass|priorityclass|PreemptLowerPriority|Never/);
      }

      const solution = LEVEL_SOLUTIONS[level.slug]!;
      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const healthy = engine.getSnapshot();
      expect(
        healthy.pods
          .filter((pod) => pod.metadata?.labels?.app === "reporting")
          .every((pod) => pod.spec?.priorityClassName === "batch-low"),
      ).toBe(true);
      expect(
        healthy.pods
          .filter((pod) => pod.metadata?.labels?.app === "public-api")
          .every((pod) => pod.status?.phase === "Running"),
      ).toBe(true);
      expect(healthy.events.every((event) => event.type !== "Warning")).toBe(true);
      const report = await engine.validate(level, { ...files, ...solution.files });
      expect(report.passed).toBe(true);
    } finally {
      await engine.close();
    }
  });

  it("makes the zombie ReplicaSet retirement valid YAML and keeps the curriculum moving", () => {
    const level = getLevelBySlug("zombie-replicaset")!;
    const constraint = level.constraints.find(
      (candidate) => candidate.kind === "manifest" && candidate.id === "keep-capacity",
    );
    expect(constraint?.kind).toBe("manifest");
    if (constraint?.kind !== "manifest") return;
    expect(constraint.assertions).toContainEqual({
      path: "spec.replicas",
      operator: "equals",
      value: 0,
    });
    expect(level.quickCommands.some((command) => command.id === "command-legacy-pod")).toBe(true);
    expect(level.postSolveExplanation.recommendedNextSlugs).toContain(
      "all-replicas-one-failure-domain",
    );
  });
});
