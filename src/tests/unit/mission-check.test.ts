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
