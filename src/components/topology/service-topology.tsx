"use client";

import "@xyflow/react/dist/style.css";

import { Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

import { isPodReady, readyEndpointCount } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { palette } from "@/lib/design/tokens";

import type { SelectedObject } from "@/features/problems/level-store";

interface TopologyProps {
  snapshot: ClusterSnapshot;
  namespace?: string;
  onSelect?: (object: SelectedObject) => void;
}

function nodeStyle(ok: boolean): React.CSSProperties {
  return {
    background: palette.panelElevated,
    border: `1px solid ${ok ? palette.green : palette.red}`,
    borderRadius: 10,
    color: palette.text,
    fontSize: 11,
    padding: "8px 10px",
    width: 168,
  };
}

function label(title: string, status: string, ok: boolean): React.ReactNode {
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ color: ok ? palette.green : palette.red, fontSize: 10 }}>{status}</div>
    </div>
  );
}

/**
 * Builds a Service → Deployment → Pods graph from the live snapshot. Node borders and
 * status text (never color alone) indicate ready/not-ready. Clicking a node selects it.
 */
export function ServiceTopology({ snapshot, namespace = "default", onSelect }: TopologyProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const services = snapshot.services.filter(
      (s) => (s.metadata?.namespace ?? "default") === namespace,
    );
    const deployments = snapshot.deployments.filter(
      (d) => (d.metadata?.namespace ?? "default") === namespace,
    );
    const pods = snapshot.pods.filter((p) => (p.metadata?.namespace ?? "default") === namespace);

    const service = services[0];
    const deployment = deployments[0];

    if (service) {
      const endpoints = readyEndpointCount(service, snapshot.endpointSlices);
      const ok = endpoints > 0;
      nodes.push({
        id: "svc",
        position: { x: 150, y: 0 },
        data: {
          label: label(
            `Service ${service.metadata?.name ?? ""}`,
            `${endpoints} ready endpoint${endpoints === 1 ? "" : "s"}`,
            ok,
          ),
        },
        style: nodeStyle(ok),
        selectable: true,
      });
    }

    if (deployment) {
      const ready = deployment.status?.readyReplicas ?? 0;
      const desired = deployment.spec?.replicas ?? 0;
      const ok = ready >= desired && desired > 0;
      nodes.push({
        id: "deploy",
        position: { x: 150, y: 120 },
        data: {
          label: label(
            `Deployment ${deployment.metadata?.name ?? ""}`,
            `${ready}/${desired} ready`,
            ok,
          ),
        },
        style: nodeStyle(ok),
      });
      if (service)
        edges.push({ id: "svc-deploy", source: "svc", target: "deploy", animated: true });
    }

    pods.forEach((pod, index) => {
      const ok = isPodReady(pod);
      const id = `pod-${index}`;
      nodes.push({
        id,
        position: { x: index * 190, y: 260 },
        data: {
          label: label(pod.metadata?.name ?? "pod", ok ? "Ready" : "Not Ready", ok),
        },
        style: nodeStyle(ok),
      });
      if (deployment) edges.push({ id: `deploy-${id}`, source: "deploy", target: id });
    });

    return { nodes, edges };
  }, [snapshot, namespace]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_event, node) => {
        if (!onSelect) return;
        if (node.id === "svc") {
          const svc = snapshot.services[0];
          if (svc?.metadata?.name)
            onSelect({ kind: "Service", name: svc.metadata.name, namespace });
        } else if (node.id === "deploy") {
          const dep = snapshot.deployments[0];
          if (dep?.metadata?.name)
            onSelect({ kind: "Deployment", name: dep.metadata.name, namespace });
        } else if (node.id.startsWith("pod-")) {
          const idx = Number(node.id.slice(4));
          const pod = snapshot.pods[idx];
          if (pod?.metadata?.name) onSelect({ kind: "Pod", name: pod.metadata.name, namespace });
        }
      }}
      style={{ background: palette.panel }}
    >
      <Background color={palette.border} gap={16} />
    </ReactFlow>
  );
}
