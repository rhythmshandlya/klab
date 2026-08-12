import { describe, expect, it } from "vitest";

import {
  parseKubernetesManifests,
  parseManifests,
  stringifyManifest,
} from "@/lib/kube/manifest-parser";

const DEPLOYMENT_AND_SERVICE = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  selector:
    app: web-app
`;

describe("parseManifests", () => {
  it("parses a multi-document file into typed manifests", () => {
    const result = parseManifests(DEPLOYMENT_AND_SERVICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({
      kind: "Deployment",
      name: "web-app",
      namespace: "default",
    });
    // Namespace defaults to "default" when omitted.
    expect(result.value[1]).toMatchObject({
      kind: "Service",
      name: "web-svc",
      namespace: "default",
    });
  });

  it("returns ok with no manifests for empty input", () => {
    const result = parseManifests("   \n  ");
    expect(result).toEqual({ ok: true, value: [] });
  });

  it("skips empty documents from trailing separators", () => {
    const result = parseManifests("apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\n---\n");
    expect(result.ok && result.value).toHaveLength(1);
  });

  it("rejects an unsupported kind with a helpful message", () => {
    const result = parseManifests("apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: c");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Unsupported kind");
    expect(result.error.message).toContain("Deployment");
  });

  it("accepts structurally valid resources for policy and architecture assessment", () => {
    const result = parseKubernetesManifests(
      "apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: api-budget",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      apiVersion: "policy/v1",
      kind: "PodDisruptionBudget",
      name: "api-budget",
      namespace: "default",
    });
  });

  it("rejects a manifest missing metadata.name", () => {
    const result = parseManifests("apiVersion: v1\nkind: Pod\nspec: {}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("metadata.name");
  });

  it("reports a YAML syntax error rather than throwing", () => {
    const result = parseManifests("apiVersion: v1\n  kind: : : bad");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("YAML syntax error");
  });

  it("round-trips through stringifyManifest", () => {
    const yaml = stringifyManifest({ apiVersion: "v1", kind: "Pod", metadata: { name: "p" } });
    const reparsed = parseManifests(yaml);
    expect(reparsed.ok && reparsed.value[0]?.name).toBe("p");
  });
});
