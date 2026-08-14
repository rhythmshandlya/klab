import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseKubernetesManifests, stringifyManifest } from "@/lib/kube/manifest-parser";
import { createProblemEngine } from "@/lib/kube/problem-engine";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

function workspaceFiles(level: ProblemLevel): Record<string, string> {
  return Object.fromEntries(
    level.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
}

function solvedFiles(slug: string): Record<string, string> {
  const level = getLevelBySlug(slug)!;
  return { ...workspaceFiles(level), ...LEVEL_SOLUTIONS[slug]!.files };
}

function resource(yaml: string): Record<string, unknown> {
  const parsed = parseKubernetesManifests(yaml);
  if (!parsed.ok || !parsed.value[0]) throw new Error("Expected one manifest");
  return structuredClone(parsed.value[0].raw);
}

function constraintsPass(level: ProblemLevel, files: Record<string, string>): boolean {
  return evaluateLevelConstraints(level, files).every((result) => result.passed);
}

describe("Problems 49-52 end-to-end contracts", () => {
  it("shows a terminating Preview and deletes it after either empty or absent finalizers", async () => {
    const level = getLevelBySlug("finalizer-never-finishes")!;
    const emptyListFiles = workspaceFiles(level);
    const preview = resource(emptyListFiles["preview.yaml"]!);
    (preview.metadata as Record<string, unknown>).finalizers = [];
    emptyListFiles["preview.yaml"] = stringifyManifest(preview);
    expect(constraintsPass(level, emptyListFiles)).toBe(true);

    const engine = createProblemEngine(level.engine);
    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const broken = engine.getSnapshot();
      const brokenPreview = broken.resources?.find(
        (candidate) =>
          candidate.kind === "Preview" && candidate.metadata?.name === "checkout-pr-184",
      );
      expect(brokenPreview?.metadata?.deletionTimestamp).toBe("2026-08-14T03:25:00Z");
      expect(brokenPreview?.metadata?.finalizers).toContain(
        "previews.platform.example.com/cleanup",
      );
      expect(
        broken.resources?.find(
          (candidate) =>
            candidate.kind === "ConfigMap" &&
            candidate.metadata?.name === "checkout-pr-184-cleanup-audit",
        )?.data,
      ).toMatchObject({ externalResourcesRemaining: "0", verification: "complete" });

      expect((await engine.applyFiles(emptyListFiles)).ok).toBe(true);
      expect(
        engine
          .getSnapshot()
          .resources?.some(
            (candidate) =>
              candidate.kind === "Preview" && candidate.metadata?.name === "checkout-pr-184",
          ),
      ).toBe(false);
      expect((await engine.validate(level, emptyListFiles)).passed).toBe(true);
    } finally {
      await engine.close();
    }
  });

  it("models the unavailable converter and preserves both CRD versions", async () => {
    const level = getLevelBySlug("conversion-webhook-locks-crs")!;
    const engine = createProblemEngine(level.engine);
    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const snapshot = engine.getSnapshot();
      expect(
        snapshot.services.find((service) => service.metadata?.name === "missing-converter"),
      ).toBeDefined();
      expect(
        snapshot.endpointSlices
          .filter(
            (slice) =>
              slice.metadata?.labels?.["kubernetes.io/service-name"] === "missing-converter",
          )
          .flatMap((slice) => slice.endpoints ?? []),
      ).toHaveLength(0);
    } finally {
      await engine.close();
    }

    const changedStorage = solvedFiles(level.slug);
    const crd = resource(changedStorage["widgets-crd.yaml"]!);
    const versions = (crd.spec as Record<string, unknown>).versions as Array<
      Record<string, unknown>
    >;
    versions.find((version) => version.name === "v1")!.storage = false;
    changedStorage["widgets-crd.yaml"] = stringifyManifest(crd);
    expect(constraintsPass(level, changedStorage)).toBe(false);

    const changedSchema = solvedFiles(level.slug);
    const schemaCrd = resource(changedSchema["widgets-crd.yaml"]!);
    const alpha = (
      (schemaCrd.spec as Record<string, unknown>).versions as Array<Record<string, unknown>>
    ).find((version) => version.name === "v1alpha1")!;
    (alpha.schema as Record<string, unknown>).openAPIV3Schema = {
      type: "object",
      properties: { legacy: { type: "string" } },
    };
    changedSchema["widgets-crd.yaml"] = stringifyManifest(schemaCrd);
    expect(constraintsPass(level, changedSchema)).toBe(false);
  });

  it("renders the informer OOM restart loop and rejects scale-to-zero or image swaps", async () => {
    const level = getLevelBySlug("informer-oomloop")!;
    const engine = createProblemEngine(level.engine);
    try {
      expect((await engine.boot(level)).ok).toBe(true);
      const pod = engine
        .getSnapshot()
        .pods.find((candidate) => candidate.metadata?.labels?.app === "invoice-operator");
      const status = pod?.status?.containerStatuses?.[0];
      expect(status?.restartCount).toBe(7);
      expect(status?.state?.waiting?.reason).toBe("CrashLoopBackOff");
      expect(status?.lastState?.terminated?.reason).toBe("OOMKilled");
      expect(engine.getLogs("billing", pod?.metadata?.name ?? "", "manager")[1]?.message).toMatch(
        /informer cache exceeded 512Mi/,
      );

      const solution = LEVEL_SOLUTIONS[level.slug]!;
      expect((await engine.applyFiles(solution.files)).ok).toBe(true);
      const healthyPod = engine
        .getSnapshot()
        .pods.find((candidate) => candidate.metadata?.labels?.app === "invoice-operator");
      expect(
        healthyPod?.status?.conditions?.some(
          (condition) => condition.type === "Ready" && condition.status === "True",
        ),
      ).toBe(true);
    } finally {
      await engine.close();
    }

    for (const mutate of [
      (deployment: Record<string, unknown>) => {
        (deployment.spec as Record<string, unknown>).replicas = 0;
      },
      (deployment: Record<string, unknown>) => {
        const podSpec = (
          (deployment.spec as Record<string, unknown>).template as Record<string, unknown>
        ).spec as Record<string, unknown>;
        (podSpec.containers as Array<Record<string, unknown>>)[0]!.image = "busybox:1.36";
      },
    ]) {
      const files = solvedFiles(level.slug);
      const deployment = resource(files["invoice-operator.yaml"]!);
      mutate(deployment);
      files["invoice-operator.yaml"] = stringifyManifest(deployment);
      expect(constraintsPass(level, files)).toBe(false);
    }
  });

  it("accepts equivalent bounded quantities and rejects resource or network escape hatches", () => {
    const level = getLevelBySlug("build-incident-survivable-observability")!;
    const alternative = solvedFiles(level.slug);
    const daemonSet = resource(alternative["node-collector.yaml"]!);
    const daemonResources = (
      ((daemonSet.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    daemonResources[0]!.resources = {
      requests: { cpu: "0.2", memory: "128Mi" },
      limits: { cpu: ".25", memory: "262144Ki" },
    };
    alternative["node-collector.yaml"] = stringifyManifest(daemonSet);

    const prometheus = resource(alternative["metrics-retention.yaml"]!);
    (prometheus.spec as Record<string, unknown>).resources = {
      requests: { cpu: "3", memory: "4Gi" },
      limits: { cpu: "4", memory: "8192Mi" },
    };
    alternative["metrics-retention.yaml"] = stringifyManifest(prometheus);

    const alerts = resource(alternative["alerts.yaml"]!);
    const groups = (alerts.spec as Record<string, unknown>).groups as Array<
      Record<string, unknown>
    >;
    (groups[0]!.rules as unknown[]).reverse();
    alternative["alerts.yaml"] = stringifyManifest(alerts);

    expect(
      evaluateLevelConstraints(level, alternative)
        .filter((result) => !result.passed)
        .map((result) => `${result.id}: ${result.detail}`),
    ).toEqual([]);
    expect(evaluateWorkspaceSemantics(level, alternative)).toEqual([]);

    const excessiveCpu = structuredClone(alternative);
    const excessiveDaemonSet = resource(excessiveCpu["node-collector.yaml"]!);
    const excessiveContainer = (
      ((excessiveDaemonSet.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    (
      (excessiveContainer[0]!.resources as Record<string, unknown>).limits as Record<
        string,
        unknown
      >
    ).cpu = "251m";
    excessiveCpu["node-collector.yaml"] = stringifyManifest(excessiveDaemonSet);
    expect(evaluateWorkspaceSemantics(level, excessiveCpu)).toContain(
      "DaemonSet/node-collector container collector must set limits.cpu at or below 250m",
    );

    const excessiveMemory = structuredClone(alternative);
    const excessivePrometheus = resource(excessiveMemory["metrics-retention.yaml"]!);
    (
      ((excessivePrometheus.spec as Record<string, unknown>).resources as Record<string, unknown>)
        .limits as Record<string, unknown>
    ).memory = "8193Mi";
    excessiveMemory["metrics-retention.yaml"] = stringifyManifest(excessivePrometheus);
    expect(evaluateWorkspaceSemantics(level, excessiveMemory)).toContain(
      "Prometheus/platform container prometheus must set limits.memory at or below 8Gi",
    );

    const requestAboveLimit = structuredClone(alternative);
    const mismatchedDaemonSet = resource(requestAboveLimit["node-collector.yaml"]!);
    const mismatchedContainer = (
      ((mismatchedDaemonSet.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    const mismatchedResources = mismatchedContainer[0]!.resources as Record<string, unknown>;
    (mismatchedResources.requests as Record<string, unknown>).cpu = "250m";
    (mismatchedResources.limits as Record<string, unknown>).cpu = "100m";
    requestAboveLimit["node-collector.yaml"] = stringifyManifest(mismatchedDaemonSet);
    expect(evaluateWorkspaceSemantics(level, requestAboveLimit)).toContain(
      "DaemonSet/node-collector container collector cpu request must not exceed its limit",
    );

    const widenedNetwork = structuredClone(alternative);
    const policy = resource(widenedNetwork["scrape-policy.yaml"]!);
    ((policy.spec as Record<string, unknown>).ingress as unknown[]).push({
      from: [{ namespaceSelector: { matchLabels: { access: "contractors" } } }],
      ports: [{ protocol: "TCP", port: 9090 }],
    });
    widenedNetwork["scrape-policy.yaml"] = stringifyManifest(policy);
    expect(evaluateWorkspaceSemantics(level, widenedNetwork)).toContain(
      "NetworkPolicy/checkout-metrics-ingress does not match its exact ingress traffic contract",
    );
  });
});
