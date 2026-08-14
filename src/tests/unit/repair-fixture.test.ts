import { describe, expect, it } from "vitest";

import { buildRepairFixture } from "@/content/levels/repair-fixture";

describe("production repair fixture fidelity", () => {
  it("derives the repaired Pod count from the repaired workload manifest", () => {
    const deployment = (replicas: number) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      k8s-app: kube-dns
  template:
    metadata:
      labels:
        k8s-app: kube-dns
    spec:
      containers:
        - name: coredns
          image: registry.k8s.io/coredns/coredns:v1.12.0
`;

    const fixture = buildRepairFixture({
      manifest: deployment(1),
      repairedManifest: deployment(3),
      resource: { kind: "Deployment", name: "coredns", namespace: "kube-system" },
      symptom: "DNS requests time out",
    });

    expect(fixture.broken.workloads?.[0]?.replicas).toBe(1);
    expect(fixture.broken.pods).toHaveLength(1);
    expect(fixture.healthy.workloads?.[0]?.replicas).toBe(3);
    expect(fixture.healthy.pods).toHaveLength(3);
  });

  it("does not invent application Pods for a non-workload resource", () => {
    const storageClass = (bindingMode: string) => `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: regional-ssd-delayed
provisioner: pd.csi.storage.gke.io
volumeBindingMode: ${bindingMode}
`;

    const fixture = buildRepairFixture({
      manifest: storageClass("Immediate"),
      repairedManifest: storageClass("WaitForFirstConsumer"),
      resource: { kind: "StorageClass", name: "regional-ssd-delayed" },
      symptom: "the database Pod cannot satisfy volume topology",
    });

    expect(fixture.broken.pods).toEqual([]);
    expect(fixture.healthy.pods).toEqual([]);
    expect(fixture.broken.resources?.[0]?.kind).toBe("StorageClass");
  });

  it("keeps shared support objects and applies state-specific resource overlays", () => {
    const service = (policy: string) => `apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: app
spec:
  externalTrafficPolicy: ${policy}
  selector:
    app: api
  ports:
    - port: 80
`;
    const hpa = (reason: string) => ({
      apiVersion: "autoscaling/v2",
      kind: "HorizontalPodAutoscaler",
      metadata: { name: "api", namespace: "app" },
      ...(reason === "Shared"
        ? { spec: { scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "api" } } }
        : {}),
      status: { conditions: [{ type: "ScalingActive", reason }] },
    });

    const fixture = buildRepairFixture({
      manifest: service("Local"),
      repairedManifest: service("Cluster"),
      resource: { kind: "Service", name: "api", namespace: "app" },
      symptom: "traffic is dropped",
      overrides: {
        resources: [hpa("Shared")],
        brokenResources: [hpa("FailedGetResourceMetric")],
        healthyResources: [hpa("ValidMetricFound")],
        services: [
          {
            name: "api",
            namespace: "policy-system",
            clusterIP: "10.96.0.20",
            selector: { app: "policy-api" },
            ports: [{ name: "http", port: 80, targetPort: 8080 }],
          },
        ],
      },
    });

    const reason = (resources: typeof fixture.broken.resources) =>
      resources?.find((resource) => resource.kind === "HorizontalPodAutoscaler")?.status;
    expect(reason(fixture.broken.resources)).toEqual({
      conditions: [{ type: "ScalingActive", reason: "FailedGetResourceMetric" }],
    });
    expect(reason(fixture.healthy.resources)).toEqual({
      conditions: [{ type: "ScalingActive", reason: "ValidMetricFound" }],
    });
    expect(
      fixture.broken.resources?.find((resource) => resource.kind === "HorizontalPodAutoscaler")
        ?.spec,
    ).toEqual({
      scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "api" },
    });
    expect(
      fixture.broken.resources?.filter((resource) => resource.kind === "HorizontalPodAutoscaler"),
    ).toHaveLength(1);
    expect(fixture.broken.services?.map((candidate) => candidate.namespace ?? "app")).toEqual([
      "app",
      "policy-system",
    ]);
  });
});
