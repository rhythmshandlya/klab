import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseKubernetesManifests, stringifyManifest } from "@/lib/kube/manifest-parser";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

const BATCH = [
  "build-multi-team-gateway",
  "volume-bound-wrong-zone",
  "volume-attach-storm",
  "build-recoverable-stateful-data-plane",
] as const;

function solved(slug: (typeof BATCH)[number]): {
  level: ProblemLevel;
  files: Record<string, string>;
} {
  const level = getLevelBySlug(slug);
  const solution = LEVEL_SOLUTIONS[slug];
  if (!level || !solution) throw new Error(`Missing level or solution for ${slug}`);
  return {
    level,
    files: {
      ...Object.fromEntries(level.files.map((file) => [file.path, file.initialValue])),
      ...solution.files,
    },
  };
}

function resource(yaml: string): Record<string, unknown> {
  const parsed = parseKubernetesManifests(yaml);
  if (!parsed.ok || !parsed.value[0]) throw new Error("Expected one Kubernetes manifest");
  return structuredClone(parsed.value[0].raw);
}

function constraint(
  level: ProblemLevel,
  files: Record<string, string>,
  id: string,
): ReturnType<typeof evaluateLevelConstraints>[number] {
  const result = evaluateLevelConstraints(level, files).find(
    (candidate) => candidate.id === `constraint:${id}`,
  );
  if (!result) throw new Error(`Missing constraint ${id}`);
  return result;
}

describe("Problems 33–36 architecture contracts", () => {
  it("keeps all four canonical workspaces accepted by constraints and semantics", () => {
    for (const slug of BATCH) {
      const { level, files } = solved(slug);
      expect(
        evaluateLevelConstraints(level, files).filter((result) => !result.passed),
        slug,
      ).toEqual([]);
      expect(evaluateWorkspaceSemantics(level, files), slug).toEqual([]);
    }
  });

  it("enforces collection cardinality for arrays and objects", () => {
    const { level, files } = solved("build-multi-team-gateway");

    const gateway = resource(files["gateway.yaml"]!);
    const gatewaySpec = gateway.spec as Record<string, unknown>;
    const listeners = gatewaySpec.listeners as unknown[];
    listeners.push(structuredClone(listeners[0]));
    files["gateway.yaml"] = stringifyManifest(gateway);

    const gatewayResult = constraint(level, files, "architecture-gateway-yaml");
    expect(gatewayResult.passed).toBe(false);
    expect(gatewayResult.diagnostic).toContain("spec.listeners must contain exactly 1 item");

    const objectLevel = structuredClone(level);
    const namespaceConstraint = objectLevel.constraints.find(
      (entry) => entry.kind === "manifest" && entry.file === "catalog-namespace.yaml",
    );
    if (!namespaceConstraint || namespaceConstraint.kind !== "manifest") {
      throw new Error("Missing catalog Namespace constraint");
    }
    namespaceConstraint.assertions = [
      { path: "metadata.labels", operator: "length-equals", value: 2 },
    ];
    objectLevel.constraints = [namespaceConstraint];
    const originalNamespace = solved("build-multi-team-gateway").files["catalog-namespace.yaml"]!;
    expect(
      evaluateLevelConstraints(objectLevel, { "catalog-namespace.yaml": originalNamespace })[0]
        ?.passed,
    ).toBe(true);
    expect(
      evaluateLevelConstraints(objectLevel, {
        "catalog-namespace.yaml": originalNamespace.replace(
          "    owner: catalog",
          "    owner: catalog\n    environment: production",
        ),
      })[0]?.passed,
    ).toBe(false);
  });

  it("accepts order-independent certificate SANs but rejects a second listener", () => {
    const { level, files } = solved("build-multi-team-gateway");
    files["certificate.yaml"] = files["certificate.yaml"]!.replace(
      "    - catalog.example.com\n    - pay.example.com",
      "    - pay.example.com\n    - catalog.example.com",
    );
    expect(constraint(level, files, "architecture-certificate-yaml").passed).toBe(true);

    const gateway = resource(files["gateway.yaml"]!);
    const listeners = (gateway.spec as Record<string, unknown>).listeners as unknown[];
    listeners.push({ name: "http", protocol: "HTTP", port: 80 });
    files["gateway.yaml"] = stringifyManifest(gateway);
    expect(constraint(level, files, "architecture-gateway-yaml").passed).toBe(false);
  });

  it("rejects a route port the referenced Service does not expose", () => {
    const { level, files } = solved("build-multi-team-gateway");
    const route = resource(files["catalog-route.yaml"]!);
    const rules = (route.spec as Record<string, unknown>).rules as Array<Record<string, unknown>>;
    const backendRefs = rules[0]!.backendRefs as Array<Record<string, unknown>>;
    backendRefs[0]!.port = 9090;
    files["catalog-route.yaml"] = stringifyManifest(route);

    expect(evaluateWorkspaceSemantics(level, files)).toContain(
      "HTTPRoute/catalog backend Service/catalog-api does not expose port 9090",
    );
  });

  it("accepts required zone anti-affinity as an equivalent hard spread", () => {
    const { level, files } = solved("build-recoverable-stateful-data-plane");
    const statefulSet = resource(files["statefulset.yaml"]!);
    const podSpec = (
      (statefulSet.spec as Record<string, unknown>).template as Record<string, unknown>
    ).spec as Record<string, unknown>;
    delete podSpec.topologySpreadConstraints;
    podSpec.affinity = {
      podAntiAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: [
          {
            topologyKey: "topology.kubernetes.io/zone",
            labelSelector: { matchLabels: { app: "orders-db" } },
          },
        ],
      },
    };
    files["statefulset.yaml"] = stringifyManifest(statefulSet);

    expect(constraint(level, files, "architecture-statefulset-yaml").passed).toBe(true);
    expect(evaluateWorkspaceSemantics(level, files)).toEqual([]);
  });

  it("rejects a hard single-zone pin that defeats the declared spread", () => {
    const { level, files } = solved("build-recoverable-stateful-data-plane");
    const statefulSet = resource(files["statefulset.yaml"]!);
    const podSpec = (
      (statefulSet.spec as Record<string, unknown>).template as Record<string, unknown>
    ).spec as Record<string, unknown>;
    podSpec.nodeSelector = { "topology.kubernetes.io/zone": "zone-a" };
    files["statefulset.yaml"] = stringifyManifest(statefulSet);

    expect(constraint(level, files, "architecture-statefulset-yaml").passed).toBe(false);
  });

  it("rejects extra primary claims and extra restore volumes", () => {
    const { level, files } = solved("build-recoverable-stateful-data-plane");
    const statefulSet = resource(files["statefulset.yaml"]!);
    const templates = (statefulSet.spec as Record<string, unknown>).volumeClaimTemplates as Array<
      Record<string, unknown>
    >;
    const extraClaim = structuredClone(templates[0]!);
    (extraClaim.metadata as Record<string, unknown>).name = "scratch";
    templates.push(extraClaim);
    files["statefulset.yaml"] = stringifyManifest(statefulSet);
    expect(constraint(level, files, "architecture-statefulset-yaml").passed).toBe(false);

    const restore = resource(files["restore-check.yaml"]!);
    const restorePodSpec = (
      (restore.spec as Record<string, unknown>).template as Record<string, unknown>
    ).spec as Record<string, unknown>;
    (restorePodSpec.volumes as unknown[]).push({
      name: "primary",
      persistentVolumeClaim: { claimName: "data-orders-db-0" },
    });
    files["restore-check.yaml"] = stringifyManifest(restore);
    expect(constraint(level, files, "architecture-restore-check-yaml").passed).toBe(false);
  });
});

describe("Problems 34–35 repair fidelity", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it("pins the GKE provisioner and preserves the 12-shard workload", () => {
    const volume = solved("volume-bound-wrong-zone");
    volume.files["storage-class.yaml"] = volume.files["storage-class.yaml"]!.replace(
      "pd.csi.storage.gke.io",
      "example.invalid/provisioner",
    );
    expect(constraint(volume.level, volume.files, "production-requirements").passed).toBe(false);

    const storm = solved("volume-attach-storm");
    storm.files["search-statefulset.yaml"] = storm.files["search-statefulset.yaml"]!.replace(
      "replicas: 12",
      "replicas: 0",
    );
    expect(constraint(storm.level, storm.files, "production-requirements").passed).toBe(false);
  });

  it("shows the real bound-volume zone conflict and the migrated healthy placement", async () => {
    const { level, files } = solved("volume-bound-wrong-zone");
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const before = engine.getSnapshot();
    expect(before.pods[0]?.metadata?.namespace).toBe("data");
    expect(before.pods[0]?.status?.phase).toBe("Pending");
    expect(before.events.some((event) => event.reason === "FailedScheduling")).toBe(true);
    expect(JSON.stringify(before.resources)).toContain("zone-a");

    for (const quick of level.quickCommands) {
      const result = await engine.runCommand(quick.command, "default", files);
      expect(result.isError, quick.command).toBe(false);
      expect(result.output, quick.command).not.toMatch(/not found|No resources found|unsupported/i);
    }

    expect((await engine.applyFiles(files)).ok).toBe(true);
    const after = engine.getSnapshot();
    expect(after.pods[0]?.spec?.nodeName).toBe("database-b-1");
    expect(after.pods[0]?.status?.phase).toBe("Running");
    expect(JSON.stringify(after.resources)).toContain("zonal-ssd-delayed");
    expect(JSON.stringify(after.resources)).toContain("zone-b");
  });

  it("shows one blocked ordinal plus stale attachments, then a fully attached fleet", async () => {
    const { level, files } = solved("volume-attach-storm");
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const before = engine.getSnapshot();
    expect(before.pods).toHaveLength(12);
    expect(before.pods.filter((pod) => pod.status?.phase === "Pending")).toHaveLength(1);
    expect(
      (before.resources ?? []).filter((item) => item.kind === "VolumeAttachment"),
    ).toHaveLength(4);

    for (const quick of level.quickCommands) {
      const result = await engine.runCommand(quick.command, "default", files);
      expect(result.isError, quick.command).toBe(false);
      expect(result.output, quick.command).not.toMatch(/not found|No resources found|unsupported/i);
    }

    expect((await engine.applyFiles(files)).ok).toBe(true);
    const after = engine.getSnapshot();
    expect(after.pods.every((pod) => pod.status?.phase === "Running")).toBe(true);
    const attachments = (after.resources ?? []).filter((item) => item.kind === "VolumeAttachment");
    expect(attachments).toHaveLength(12);
    expect(
      attachments.every(
        (item) => (item.status as Record<string, unknown> | undefined)?.attached === true,
      ),
    ).toBe(true);
  });
});
