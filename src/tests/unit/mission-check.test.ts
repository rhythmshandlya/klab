import { describe, expect, it } from "vitest";
import { evaluateDoCheck } from "@/lib/kube/mission-check";
import type { ClusterSnapshot } from "@/lib/kube/simulator";

const empty: ClusterSnapshot = { pods: [], services: [], deployments: [], replicaSets: [], endpointSlices: [], namespaces: [], nodes: [], events: [] };

describe("evaluateDoCheck pods-ready", () => {
  it("fails on empty cluster", () => {
    const r = evaluateDoCheck(empty, { kind: "pods-ready", selector: { app: "web" }, minReady: 1 });
    expect(r.passed).toBe(false);
  });
  it("passes when enough matching pods are ready", () => {
    const snap: ClusterSnapshot = { ...empty, pods: [
      { metadata: { name: "web-1", namespace: "default", labels: { app: "web" } },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }], containerStatuses: [{ ready: true, restartCount: 0, name: "web", image: "web:latest", imageID: "" }] } },
    ] as ClusterSnapshot["pods"] };
    const r = evaluateDoCheck(snap, { kind: "pods-ready", selector: { app: "web" }, minReady: 1 });
    expect(r.passed).toBe(true);
  });
});

describe("evaluateDoCheck deployment-available", () => {
  it("fails on empty cluster", () => {
    const r = evaluateDoCheck(empty, { kind: "deployment-available", name: "web", minAvailable: 1 });
    expect(r.passed).toBe(false);
    expect(r.detail).toBeTruthy();
  });
  it("passes when deployment has enough ready replicas", () => {
    const snap: ClusterSnapshot = { ...empty, deployments: [
      {
        metadata: { name: "web", namespace: "default" },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: "web" } },
          template: { metadata: { labels: { app: "web" } } },
        },
        status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1 },
      },
    ] as ClusterSnapshot["deployments"] };
    const r = evaluateDoCheck(snap, { kind: "deployment-available", name: "web", minAvailable: 1 });
    expect(r.passed).toBe(true);
    expect(r.detail).toMatch(/1\/1 available/);
  });
});

describe("evaluateDoCheck deployment-replicas", () => {
  const deploymentAt = (desired: number, ready: number): ClusterSnapshot => ({
    ...empty,
    deployments: [
      {
        metadata: { name: "web", namespace: "default" },
        spec: {
          replicas: desired,
          selector: { matchLabels: { app: "web" } },
          template: { metadata: { labels: { app: "web" } } },
        },
        status: { replicas: desired, readyReplicas: ready, updatedReplicas: ready },
      },
    ] as ClusterSnapshot["deployments"],
  });

  it("fails when desired exceeds the exact target, even if enough are ready", () => {
    // The downscale gate: 3 ready >= 2 would satisfy a min-check, but desired is still 3.
    const r = evaluateDoCheck(deploymentAt(3, 3), { kind: "deployment-replicas", name: "web", replicas: 2 });
    expect(r.passed).toBe(false);
    expect(r.detail).toMatch(/desired 3 \(want 2\)/);
  });
  it("fails while converging (desired matches but not enough ready)", () => {
    const r = evaluateDoCheck(deploymentAt(2, 1), { kind: "deployment-replicas", name: "web", replicas: 2 });
    expect(r.passed).toBe(false);
  });
  it("passes when desired matches exactly and replicas are ready", () => {
    const r = evaluateDoCheck(deploymentAt(2, 2), { kind: "deployment-replicas", name: "web", replicas: 2 });
    expect(r.passed).toBe(true);
  });
  it("fails when the deployment does not exist", () => {
    const r = evaluateDoCheck(empty, { kind: "deployment-replicas", name: "web", replicas: 2 });
    expect(r.passed).toBe(false);
  });
});

describe("evaluateDoCheck service-has-endpoints", () => {
  it("fails when service has no ready endpoints", () => {
    const snap: ClusterSnapshot = { ...empty, services: [
      {
        metadata: { name: "web-svc", namespace: "default" },
        spec: {
          clusterIP: "10.96.0.1",
          selector: { app: "web" },
          ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
        },
      },
    ] as ClusterSnapshot["services"] };
    const r = evaluateDoCheck(snap, { kind: "service-has-endpoints", name: "web-svc", minEndpoints: 1 });
    expect(r.passed).toBe(false);
    expect(r.detail).toBeTruthy();
  });
  it("passes when service has ready endpoints", () => {
    const snap: ClusterSnapshot = { ...empty, services: [
      {
        metadata: { name: "web-svc", namespace: "default" },
        spec: {
          clusterIP: "10.96.0.1",
          selector: { app: "web" },
          ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
        },
      },
    ] as ClusterSnapshot["services"], endpointSlices: [
      {
        metadata: {
          name: "web-svc-1",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "web-svc" },
        },
        addressType: "IPv4",
        endpoints: [
          {
            addresses: ["10.0.0.1"],
            conditions: { ready: true },
            targetRef: { name: "web-pod-1" },
          },
        ],
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ] as ClusterSnapshot["endpointSlices"] };
    const r = evaluateDoCheck(snap, { kind: "service-has-endpoints", name: "web-svc", minEndpoints: 1 });
    expect(r.passed).toBe(true);
    expect(r.detail).toMatch(/1\/1 ready endpoints/);
  });
});
