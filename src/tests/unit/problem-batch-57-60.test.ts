import { afterEach, describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ClusterFixture, ProblemLevel } from "@/lib/domain/types";
import { renderFixtureSnapshot } from "@/lib/kube/cluster-fixture";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseKubernetesManifests, stringifyManifest } from "@/lib/kube/manifest-parser";
import { createProblemEngine, type ProblemEngine } from "@/lib/kube/problem-engine";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

const BATCH = [
  "build-two-team-platform",
  "quota-without-defaults-blocks-pods",
  "mutable-tag-split-brain",
  "build-signed-promotion-pipeline",
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

function constraintsPass(level: ProblemLevel, files: Record<string, string>): boolean {
  return evaluateLevelConstraints(level, files).every((result) => result.passed);
}

describe("Problems 57-60 end-to-end contracts", () => {
  let engine: ProblemEngine | undefined;

  afterEach(async () => {
    await engine?.close();
    engine = undefined;
  });

  it("accepts every canonical workspace", () => {
    for (const slug of BATCH) {
      const { level, files } = solved(slug);
      expect(
        evaluateLevelConstraints(level, files).filter((result) => !result.passed),
        slug,
      ).toEqual([]);
      expect(evaluateWorkspaceSemantics(level, files), slug).toEqual([]);
    }
  });

  it("rejects asymmetric RBAC and broadened DNS egress for either tenant", () => {
    const duplicateRule = solved("build-two-team-platform");
    const role = resource(duplicateRule.files["beacon-role.yaml"]!);
    const rules = role.rules as unknown[];
    rules.push(structuredClone(rules[0]));
    duplicateRule.files["beacon-role.yaml"] = stringifyManifest(role);
    expect(evaluateWorkspaceSemantics(duplicateRule.level, duplicateRule.files)).toContain(
      "Role/team-developer must contain exactly 2 rules",
    );

    const broadenedDns = solved("build-two-team-platform");
    const policy = resource(broadenedDns.files["atlas-dns-egress.yaml"]!);
    const egress = (policy.spec as Record<string, unknown>).egress as Array<
      Record<string, unknown>
    >;
    egress.push({
      to: [{ namespaceSelector: { matchLabels: { access: "contractors" } } }],
      ports: [{ protocol: "TCP", port: 443 }],
    });
    broadenedDns.files["atlas-dns-egress.yaml"] = stringifyManifest(policy);
    expect(evaluateWorkspaceSemantics(broadenedDns.level, broadenedDns.files)).toContain(
      "NetworkPolicy/allow-cluster-dns does not match its exact egress traffic contract",
    );
  });

  it("shows quota admission failure before defaults and two ready Pods after repair", async () => {
    const { level, files } = solved("quota-without-defaults-blocks-pods");
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const before = engine.getSnapshot();
    expect(before.pods).toHaveLength(0);
    expect(before.deployments.find((item) => item.metadata?.name === "web")).toBeDefined();
    expect(
      before.resources?.some(
        (item) => item.kind === "ResourceQuota" && item.metadata.name === "team-blue-compute",
      ),
    ).toBe(true);
    expect(before.events.some((event) => event.reason === "FailedCreate")).toBe(true);

    for (const quick of level.quickCommands) {
      const result = await engine.runCommand(quick.command, "team-blue", files);
      expect(result.isError, quick.command).toBe(false);
      expect(result.output, quick.command).not.toMatch(/not found|No resources found|unsupported/i);
    }

    expect((await engine.applyFiles(files)).ok).toBe(true);
    const after = engine.getSnapshot();
    expect(after.pods).toHaveLength(2);
    expect(after.pods.every((pod) => pod.status?.phase === "Running")).toBe(true);

    const removedMaximum = structuredClone(files);
    const limitRange = resource(removedMaximum["team-blue-limits.yaml"]!);
    delete (
      (limitRange.spec as Record<string, unknown>).limits as Array<Record<string, unknown>>
    )[0]?.max;
    removedMaximum["team-blue-limits.yaml"] = stringifyManifest(limitRange);
    expect(constraintsPass(level, removedMaximum)).toBe(false);
  });

  it("renders same-tag split image identities and one digest-pinned repaired fleet", async () => {
    const { level, files } = solved("mutable-tag-split-brain");
    engine = createProblemEngine(level.engine);
    expect((await engine.boot(level)).ok).toBe(true);

    const before = engine.getSnapshot();
    expect(before.pods).toHaveLength(6);
    expect(new Set(before.pods.map((pod) => pod.spec?.containers?.[0]?.image))).toEqual(
      new Set(["registry.example/api:production"]),
    );
    expect(
      new Set(before.pods.map((pod) => pod.status?.containerStatuses?.[0]?.imageID)).size,
    ).toBe(2);

    const initialFiles = Object.fromEntries(
      level.files.map((file) => [file.path, file.initialValue]),
    );
    const renderedBefore = await engine.runCommand(
      "kubectl kustomize overlays/production",
      "production",
      initialFiles,
    );
    expect(renderedBefore.isError).toBe(false);
    expect(renderedBefore.output).toContain("registry.example/api:production");

    const renderedAfter = await engine.runCommand(
      "kubectl kustomize overlays/production",
      "production",
      files,
    );
    expect(renderedAfter.isError).toBe(false);
    expect(renderedAfter.output).toContain(
      "registry.example/api@sha256:4d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b914d7f8b91",
    );

    expect((await engine.applyFiles(files)).ok).toBe(true);
    const after = engine.getSnapshot();
    expect(after.pods).toHaveLength(6);
    expect(new Set(after.pods.map((pod) => pod.status?.containerStatuses?.[0]?.imageID)).size).toBe(
      1,
    );

    const extraTransform = structuredClone(files);
    const overlay = resource(extraTransform["overlays/production/kustomization.yaml"]!);
    (overlay.images as unknown[]).push({ name: "registry.example/sidecar", newTag: "latest" });
    extraTransform["overlays/production/kustomization.yaml"] = stringifyManifest(overlay);
    expect(constraintsPass(level, extraTransform)).toBe(false);
  });

  it("prefers declared runtime image IDs in fixture Pod status", () => {
    const fixture: ClusterFixture = {
      namespace: "production",
      pods: [
        {
          name: "api-1",
          labels: { app: "api" },
          containers: [
            {
              name: "api",
              image: "registry.example/api:production",
              imageID: "registry.example/api@sha256:1234",
            },
          ],
        },
      ],
    };
    expect(renderFixtureSnapshot(fixture).pods[0]?.status?.containerStatuses?.[0]?.imageID).toBe(
      "registry.example/api@sha256:1234",
    );
  });

  it("accepts task reordering but rejects artifact, signature, and network bypasses", () => {
    const reordered = solved("build-signed-promotion-pipeline");
    const pipeline = resource(reordered.files["pipeline.yaml"]!);
    ((pipeline.spec as Record<string, unknown>).tasks as unknown[]).reverse();
    reordered.files["pipeline.yaml"] = stringifyManifest(pipeline);
    expect(constraintsPass(reordered.level, reordered.files)).toBe(true);
    expect(evaluateWorkspaceSemantics(reordered.level, reordered.files)).toEqual([]);

    const wrongRunDigest = solved("build-signed-promotion-pipeline");
    wrongRunDigest.files["pipeline-run.yaml"] = wrongRunDigest.files["pipeline-run.yaml"]!.replace(
      /sha256:a{64}/,
      `sha256:${"d".repeat(64)}`,
    );
    expect(constraintsPass(wrongRunDigest.level, wrongRunDigest.files)).toBe(false);

    const skippedInitImages = solved("build-signed-promotion-pipeline");
    const signaturePolicy = resource(skippedInitImages.files["signature-policy.yaml"]!);
    const variables = (signaturePolicy.spec as Record<string, unknown>).variables as Array<
      Record<string, unknown>
    >;
    variables[0]!.expression =
      "object.spec.template.spec.containers.map(container, container.image)";
    skippedInitImages.files["signature-policy.yaml"] = stringifyManifest(signaturePolicy);
    expect(evaluateWorkspaceSemantics(skippedInitImages.level, skippedInitImages.files)).toContain(
      "ImageValidatingPolicy/verify-production-images must apply the exact trusted-registry and signature checks to every regular and init container image",
    );

    const malformedDigestPolicy = solved("build-signed-promotion-pipeline");
    const weakPolicy = resource(malformedDigestPolicy.files["signature-policy.yaml"]!);
    const validations = (weakPolicy.spec as Record<string, unknown>).validations as Array<
      Record<string, unknown>
    >;
    validations[0]!.expression =
      "variables.allImages.all(image, image.startsWith('registry.example/') && image.contains('@sha256:'))";
    malformedDigestPolicy.files["signature-policy.yaml"] = stringifyManifest(weakPolicy);
    expect(
      evaluateWorkspaceSemantics(malformedDigestPolicy.level, malformedDigestPolicy.files),
    ).toContain(
      "ImageValidatingPolicy/verify-production-images must apply the exact trusted-registry and signature checks to every regular and init container image",
    );

    const broadNetwork = solved("build-signed-promotion-pipeline");
    const policy = resource(broadNetwork.files["registry-egress.yaml"]!);
    ((policy.spec as Record<string, unknown>).egress as unknown[]).push({
      to: [{ ipBlock: { cidr: "10.0.0.0/8" } }],
      ports: [{ protocol: "TCP", port: 443 }],
    });
    broadNetwork.files["registry-egress.yaml"] = stringifyManifest(policy);
    expect(evaluateWorkspaceSemantics(broadNetwork.level, broadNetwork.files)).toContain(
      "NetworkPolicy/registry-only-egress does not match its exact egress traffic contract",
    );
  });
});
