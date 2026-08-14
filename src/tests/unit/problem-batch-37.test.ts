import { describe, expect, it } from "vitest";

import { getLevelBySlug } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import type { ProblemLevel } from "@/lib/domain/types";
import { evaluateLevelConstraints } from "@/lib/kube/manifest-constraints";
import { parseKubernetesManifests, stringifyManifest } from "@/lib/kube/manifest-parser";
import { createProblemEngine } from "@/lib/kube/problem-engine";
import { evaluateWorkspaceSemantics } from "@/lib/kube/workspace-semantics";

function level(slug: string): ProblemLevel {
  const value = getLevelBySlug(slug);
  if (!value) throw new Error(`Unknown level ${slug}`);
  return value;
}

function solved(slug: string): { problem: ProblemLevel; files: Record<string, string> } {
  const problem = level(slug);
  const files = Object.fromEntries(
    problem.files
      .filter((file) => file.access !== "hidden")
      .map((file) => [file.path, file.initialValue]),
  );
  return { problem, files: { ...files, ...LEVEL_SOLUTIONS[slug]!.files } };
}

function constraintFailures(problem: ProblemLevel, files: Record<string, string>): string[] {
  return evaluateLevelConstraints(problem, files)
    .filter((result) => !result.passed)
    .map((result) => result.id);
}

function resource(yaml: string): Record<string, unknown> {
  const parsed = parseKubernetesManifests(yaml);
  if (!parsed.ok || !parsed.value[0]) throw new Error("Expected a Kubernetes resource");
  return structuredClone(parsed.value[0].raw);
}

describe("Problems 37–40 acceptance regressions", () => {
  it("accepts either Role rule order but rejects authority outside the operator contract", () => {
    const { problem, files } = solved("operator-cannot-update-status");
    const role = resource(files["operator-role.yaml"]!);
    (role.rules as unknown[]).reverse();
    files["operator-role.yaml"] = stringifyManifest(role);

    expect(constraintFailures(problem, files)).toEqual([]);
    expect(evaluateWorkspaceSemantics(problem, files)).toEqual([]);

    ((role.rules as Array<Record<string, unknown>>)[0]!.verbs as string[]).push("delete");
    files["operator-role.yaml"] = stringifyManifest(role);
    expect(evaluateWorkspaceSemantics(problem, files)).toContain(
      "Role/database-operator grants authority outside the database reconciliation contract",
    );
  });

  it("rejects an invalid zero webhook timeout and a redirected webhook client", () => {
    const { problem, files } = solved("admission-webhook-deadlock");
    const zeroTimeout = {
      ...files,
      "validating-webhook.yaml": files["validating-webhook.yaml"]!.replace(
        "timeoutSeconds: 3",
        "timeoutSeconds: 0",
      ),
    };
    expect(constraintFailures(problem, zeroTimeout)).toContain(
      "constraint:production-requirements",
    );

    const redirected = {
      ...files,
      "validating-webhook.yaml": files["validating-webhook.yaml"]!.replace(
        "name: workload-policy\n        path: /validate",
        "name: unrelated-webhook\n        path: /validate",
      ),
    };
    expect(constraintFailures(problem, redirected)).toContain("constraint:production-requirements");
  });

  it("rejects extra admin credentials and broader policy traffic", () => {
    const { problem, files } = solved("build-hardened-admin-workload");
    const extraSecret = {
      ...files,
      "maintenance-secret.yaml": files["maintenance-secret.yaml"]!.replace(
        "  token: cmVkYWN0ZWQ=",
        "  token: cmVkYWN0ZWQ=\n  unrelated: c2VjcmV0",
      ),
    };
    expect(constraintFailures(problem, extraSecret)).toContain(
      "constraint:architecture-maintenance-secret-yaml",
    );

    const policy = resource(files["network-policy.yaml"]!);
    const ingress = (policy.spec as Record<string, unknown>).ingress as Array<
      Record<string, unknown>
    >;
    (ingress[0]!.ports as unknown[]).push({ protocol: "TCP", port: 9443 });
    files["network-policy.yaml"] = stringifyManifest(policy);
    expect(evaluateWorkspaceSemantics(problem, files)).toContain(
      "NetworkPolicy/admin-console-private does not match its exact ingress traffic contract",
    );
  });

  it("preserves the recommendation workload while removing only its CPU limit", () => {
    const { problem, files } = solved("low-cpu-terrible-latency");
    expect(constraintFailures(problem, files)).toEqual([]);
    files["recommendation-deployment.yaml"] = files["recommendation-deployment.yaml"]!.replace(
      /registry\.example\/recommendation@sha256:[a-f0-9]+/,
      "example.invalid/no-op:latest",
    );
    expect(constraintFailures(problem, files)).toContain("constraint:production-requirements");
  });
});

describe("Problem 38 fixture fidelity", () => {
  it("models the policy-system webhook Service with no ready endpoint until repaired", async () => {
    const { problem, files } = solved("admission-webhook-deadlock");
    const engine = createProblemEngine(problem.engine);
    try {
      expect((await engine.boot(problem)).ok).toBe(true);
      const before = engine.getSnapshot();
      expect(
        before.services.some(
          (service) =>
            service.metadata?.name === "workload-policy" &&
            service.metadata?.namespace === "policy-system",
        ),
      ).toBe(true);
      expect(
        before.endpointSlices
          .filter((slice) => slice.metadata?.namespace === "policy-system")
          .flatMap((slice) => slice.endpoints ?? [])
          .some((endpoint) => endpoint.conditions?.ready),
      ).toBe(false);

      expect((await engine.applyFiles(files)).ok).toBe(true);
      expect(
        engine
          .getSnapshot()
          .endpointSlices.filter((slice) => slice.metadata?.namespace === "policy-system")
          .flatMap((slice) => slice.endpoints ?? [])
          .some((endpoint) => endpoint.conditions?.ready),
      ).toBe(true);
    } finally {
      await engine.close();
    }
  });
});
