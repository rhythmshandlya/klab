"use client";

import "@xyflow/react/dist/style.css";

import { Background, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";

import { ServiceTopology } from "@/components/topology/service-topology";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { ConceptDiagramVariant, DiagramSpec } from "@/lib/domain/mission-types";
import { palette } from "@/lib/design/tokens";

interface Beat {
  node: Node;
  /** Explicit source id for the edge into this beat's node; defaults to the previous beat. */
  edgeFrom?: string;
}

function mk(id: string, title: string, sub: string, x: number, y: number): Node {
  return {
    id,
    position: { x, y },
    data: { label: `${title}\n${sub}` },
    style: {
      background: palette.panelElevated,
      border: `1px solid ${palette.border}`,
      borderRadius: 10,
      color: palette.text,
      fontSize: 11,
      padding: "8px 10px",
      width: 168,
      whiteSpace: "pre-line",
    },
  };
}

const VARIANTS: Record<ConceptDiagramVariant, Beat[]> = {
  "control-loop": [
    { node: mk("declare", "You declare", "spec: replicas: 3", 0, 0) },
    { node: mk("control", "Control plane", "observe → diff → act", 260, 90) },
    { node: mk("runs", "Cluster runs", "status: ready 3/3", 520, 0), edgeFrom: "control" },
  ],
  "cluster-architecture": [
    { node: mk("api-server", "API server", "validates & stores", 260, 0) },
    { node: mk("etcd", "etcd", "cluster state", 0, 110), edgeFrom: "api-server" },
    { node: mk("controllers", "Controllers", "reconcile loop", 260, 220), edgeFrom: "api-server" },
    { node: mk("scheduler", "Scheduler", "places Pods", 520, 110), edgeFrom: "api-server" },
    { node: mk("kubelet", "kubelet (worker)", "runs Pods on the node", 520, 0), edgeFrom: "api-server" },
  ],
  "api-object": [
    { node: mk("metadata", "metadata", "name, labels", 0, 0) },
    { node: mk("spec", "spec", "what you want", 260, 0) },
    { node: mk("status", "status", "what's observed", 520, 0) },
  ],
  "workload-hierarchy": [
    { node: mk("deployment", "Deployment", "rollout strategy", 0, 0) },
    { node: mk("replicaset", "ReplicaSet", "keeps N replicas", 260, 0) },
    { node: mk("pod-1", "Pod 1", "your container", 520, -60) },
    { node: mk("pod-2", "Pod 2", "your container", 520, 60), edgeFrom: "replicaset" },
  ],
  "service-routing": [
    { node: mk("client", "Client", "curl web-svc", 0, 0) },
    { node: mk("dns", "DNS", "web-svc.default.svc", 220, 0) },
    { node: mk("service", "Service", "stable VIP", 440, 0) },
    { node: mk("endpointslice", "EndpointSlice", "ready Pod IPs", 660, 0) },
    { node: mk("pod", "Pod", "traffic lands", 880, 0) },
  ],
};

/** Pure builder: cumulative nodes/edges for a variant up to (and including) buildToStep. */
export function conceptGraph(
  variant: ConceptDiagramVariant,
  buildToStep: number,
): { nodes: Node[]; edges: Edge[] } {
  const beats = VARIANTS[variant].slice(0, buildToStep + 1);
  const nodes = beats.map((b) => b.node);
  const edges: Edge[] = [];
  beats.forEach((b, i) => {
    const source = b.edgeFrom ?? (i > 0 ? beats[i - 1]?.node.id : undefined);
    if (!source) return;
    edges.push({
      id: `${source}->${b.node.id}`,
      source,
      target: b.node.id,
      animated: i === beats.length - 1,
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  });
  return { nodes, edges };
}

export function MissionDiagram({
  spec,
  snapshot,
  namespace,
}: {
  spec: DiagramSpec;
  snapshot: ClusterSnapshot;
  namespace: string;
}) {
  if (spec.mode === "live") {
    return (
      <div className="h-56">
        <ServiceTopology snapshot={snapshot} namespace={namespace} />
      </div>
    );
  }

  const { nodes, edges } = conceptGraph(spec.variant, spec.mode === "concept" ? spec.buildToStep : 99);

  return (
    <div className="h-56 rounded-md border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: palette.panel }}
      >
        <Background color={palette.border} gap={16} />
      </ReactFlow>
    </div>
  );
}
