import { describe, expect, it } from "vitest";

import type { LevelValidatorDefinition } from "@/lib/domain/types";
import type { ClusterSnapshot, KubeSimulator, ProbeResult } from "@/lib/kube/simulator";
import { runValidators } from "@/lib/kube/validators";

function emptySnapshot(): ClusterSnapshot {
  return {
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    endpointSlices: [],
    namespaces: [],
    nodes: [],
    events: [],
  };
}

function fakeSimulator(snapshot: ClusterSnapshot, probe: ProbeResult): KubeSimulator {
  // Only getSnapshot + probe are exercised by validators.
  return {
    getSnapshot: () => snapshot,
    probe: async () => probe,
  } as unknown as KubeSimulator;
}

const VALIDATORS: LevelValidatorDefinition[] = [
  {
    id: "v-deploy",
    title: "Deployment ready",
    successLabel: "Deployment has ready replicas",
    failureLabel: "Deployment has no ready replicas",
    kind: "deployment-ready",
    namespace: "default",
    name: "web-app",
    minReadyReplicas: 1,
  },
  {
    id: "v-endpoints",
    title: "Service endpoints",
    successLabel: "Service has ready endpoints",
    failureLabel: "Service has zero ready endpoints",
    kind: "service-has-ready-endpoints",
    namespace: "default",
    name: "web-svc",
    minReadyEndpoints: 1,
  },
  {
    id: "v-http",
    title: "HTTP through service",
    successLabel: "Service returns 200",
    failureLabel: "Service does not return 200",
    kind: "http-get-through-service",
    namespace: "default",
    service: "web-svc",
    port: 80,
    path: "/",
    expectStatus: 200,
  },
  {
    id: "v-noreadyfail",
    title: "No readiness failures",
    successLabel: "No failing readiness probes",
    failureLabel: "A pod is failing readiness",
    kind: "no-pods-failing-readiness",
    namespace: "default",
  },
];

function brokenSnapshot(): ClusterSnapshot {
  const snap = emptySnapshot();
  snap.deployments = [
    {
      metadata: { name: "web-app", namespace: "default" },
      spec: { replicas: 2 },
      status: { readyReplicas: 0 },
    },
  ] as any;
  snap.pods = [
    {
      metadata: { name: "web-app-abc", namespace: "default", labels: { app: "web-app" } },
      status: { phase: "Running", conditions: [{ type: "Ready", status: "False" }] },
    },
  ] as any;
  snap.services = [
    {
      metadata: { name: "web-svc", namespace: "default" },
      spec: { selector: { app: "web-app" }, clusterIP: "10.96.0.1" },
    },
  ] as any;
  snap.endpointSlices = [
    {
      metadata: {
        name: "web-svc-x",
        namespace: "default",
        labels: { "kubernetes.io/service-name": "web-svc" },
      },
      endpoints: [{ addresses: ["10.244.1.5"], conditions: { ready: false } }],
    },
  ] as any;
  return snap;
}

function fixedSnapshot(): ClusterSnapshot {
  const snap = brokenSnapshot();
  (snap.deployments[0] as any).status.readyReplicas = 2;
  (snap.pods[0] as any).status.conditions = [{ type: "Ready", status: "True" }];
  (snap.endpointSlices[0] as any).endpoints[0].conditions.ready = true;
  return snap;
}

describe("runValidators", () => {
  it("fails every relevant check in the broken state", async () => {
    const sim = fakeSimulator(brokenSnapshot(), {
      ok: false,
      status: 0,
      body: "",
      reason: "no endpoints",
    });
    const report = await runValidators(VALIDATORS, { simulator: sim });
    expect(report.passed).toBe(false);
    expect(report.results.find((r) => r.id === "v-endpoints")?.passed).toBe(false);
    expect(report.results.find((r) => r.id === "v-http")?.passed).toBe(false);
  });

  it("passes once the cluster is healthy", async () => {
    const sim = fakeSimulator(fixedSnapshot(), { ok: true, status: 200, body: "ok" });
    const report = await runValidators(VALIDATORS, { simulator: sim });
    expect(report.passed).toBe(true);
    for (const result of report.results) {
      expect(result.passed).toBe(true);
    }
  });

  it("rejects intermittent HTTP failures across a bounded sample", async () => {
    let request = 0;
    const simulator = {
      getSnapshot: emptySnapshot,
      probe: async () => {
        request += 1;
        return request % 3 === 0
          ? { ok: false, status: 502, body: "old backend" }
          : { ok: true, status: 200, body: "new backend" };
      },
    } as unknown as KubeSimulator;
    const sampled: LevelValidatorDefinition = {
      id: "sampled-http",
      title: "Sampled traffic",
      successLabel: "All samples pass",
      failureLabel: "A sample failed",
      kind: "http-sample-through-service",
      namespace: "default",
      service: "edge-api-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
      samples: 6,
      maxFailures: 0,
    };

    const report = await runValidators([sampled], { simulator });
    expect(report.passed).toBe(false);
    expect(report.results[0]?.detail).toContain("2/6 samples");
    expect(request).toBe(6);
  });
});
