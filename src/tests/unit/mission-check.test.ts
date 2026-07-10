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
