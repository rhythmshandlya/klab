"use client";

import "@xyflow/react/dist/style.css";

import { Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

import { isPodReady, podRestarts, readyEndpointCount } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { palette } from "@/lib/design/tokens";

import type { SelectedObject } from "@/features/problems/level-store";

interface TopologyProps {
  snapshot: ClusterSnapshot;
  /** Single-namespace shorthand (existing callers). */
  namespace?: string;
  /** Namespaces to render; defaults to every namespace with workload objects. */
  namespaces?: string[];
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
    width: 176,
  };
}

function nodeLabel(title: string, rows: { text: string; ok?: boolean }[]): React.ReactNode {
  return (
    <div style={{ textAlign: "left" }}>
      <div
        style={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          style={{
            color: row.ok === undefined ? palette.textSubtle : row.ok ? palette.green : palette.red,
            fontSize: 10,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.text}
        </div>
      ))}
    </div>
  );
}

function formatLabels(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "<none>";
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function matches(
  labels: Record<string, string> | undefined,
  selector: Record<string, string>,
): boolean {
  if (!labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

/**
 * Live Service → Deployment → Pod graph built from the snapshot, edges derived from
 * label selectors (the actual routing mechanism — so a zombie pod that matches a
 * Service but belongs to no Deployment shows up exactly as the anomaly it is).
 * Renders ALL matching objects across the given namespaces; node subtitles teach the
 * selector/label relationships. Clicking a node selects it in the object explorer.
 */
export function ServiceTopology({ snapshot, namespace, namespaces, onSelect }: TopologyProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const requested = namespaces ?? (namespace ? [namespace] : []);
    const nsSet =
      requested.length > 0
        ? new Set(requested)
        : new Set(
            [...snapshot.services, ...snapshot.deployments, ...snapshot.pods].map(
              (o) => o.metadata?.namespace ?? "default",
            ),
          );
    const showNs = nsSet.size > 1;
    const inScope = <T extends { metadata?: { namespace?: string } }>(items: T[]): T[] =>
      items.filter((item) => nsSet.has(item.metadata?.namespace ?? "default"));

    const services = inScope(snapshot.services);
    const deployments = inScope(snapshot.deployments);
    const pods = inScope(snapshot.pods);

    const X_STEP = 200;
    const displayName = (name: string, ns: string) => (showNs ? `${name} · ${ns}` : name);

    services.forEach((service, index) => {
      const name = service.metadata?.name ?? "";
      const ns = service.metadata?.namespace ?? "default";
      const endpoints = readyEndpointCount(service, snapshot.endpointSlices);
      const ok = endpoints > 0;
      nodes.push({
        id: `svc/${ns}/${name}`,
        position: { x: index * X_STEP, y: 0 },
        data: {
          label: nodeLabel(`⬢ ${displayName(name, ns)}`, [
            { text: `selector ${formatLabels(service.spec?.selector)}` },
            { text: `${endpoints} ready endpoint${endpoints === 1 ? "" : "s"}`, ok },
          ]),
        },
        style: nodeStyle(ok),
      });
    });

    deployments.forEach((deployment, index) => {
      const name = deployment.metadata?.name ?? "";
      const ns = deployment.metadata?.namespace ?? "default";
      const ready = deployment.status?.readyReplicas ?? 0;
      const desired = deployment.spec?.replicas ?? 0;
      const ok = desired > 0 && ready >= desired;
      nodes.push({
        id: `deploy/${ns}/${name}`,
        position: { x: index * X_STEP, y: 130 },
        data: {
          label: nodeLabel(`▣ ${displayName(name, ns)}`, [
            { text: `template ${formatLabels(deployment.spec?.template?.metadata?.labels)}` },
            { text: `${ready}/${desired} ready`, ok },
          ]),
        },
        style: nodeStyle(ok),
      });

      // Service → Deployment when the pod template's labels satisfy the selector.
      for (const service of services) {
        const selector = service.spec?.selector ?? {};
        if (Object.keys(selector).length === 0) continue;
        if (matches(deployment.spec?.template?.metadata?.labels, selector)) {
          const svcNs = service.metadata?.namespace ?? "default";
          if (svcNs !== ns) continue;
          edges.push({
            id: `svc/${svcNs}/${service.metadata?.name}->deploy/${ns}/${name}`,
            source: `svc/${svcNs}/${service.metadata?.name}`,
            target: `deploy/${ns}/${name}`,
            animated: true,
          });
        }
      }
    });

    pods.forEach((pod, index) => {
      const name = pod.metadata?.name ?? "";
      const ns = pod.metadata?.namespace ?? "default";
      const ready = isPodReady(pod);
      const restarts = podRestarts(pod);
      const rows: { text: string; ok?: boolean }[] = [
        { text: formatLabels(pod.metadata?.labels) },
        { text: ready ? "Ready" : "Not Ready", ok: ready },
      ];
      if (restarts > 0)
        rows.push({ text: `${restarts} restart${restarts === 1 ? "" : "s"}`, ok: false });
      nodes.push({
        id: `pod/${ns}/${name}`,
        position: { x: index * X_STEP, y: 270 },
        data: { label: nodeLabel(`● ${displayName(name, ns)}`, rows) },
        style: nodeStyle(ready),
      });

      // Deployment → Pod by the deployment's selector (ownership approximation).
      let owned = false;
      for (const deployment of deployments) {
        const depNs = deployment.metadata?.namespace ?? "default";
        if (depNs !== ns) continue;
        const selector = deployment.spec?.selector?.matchLabels ?? {};
        if (Object.keys(selector).length === 0) continue;
        if (matches(pod.metadata?.labels, selector)) {
          owned = true;
          edges.push({
            id: `deploy/${depNs}/${deployment.metadata?.name}->pod/${ns}/${name}`,
            source: `deploy/${depNs}/${deployment.metadata?.name}`,
            target: `pod/${ns}/${name}`,
          });
        }
      }

      // Service → Pod directly when a Service selects a pod NO deployment owns —
      // that's how an orphaned/zombie workload shows up in the graph.
      if (!owned) {
        for (const service of services) {
          const svcNs = service.metadata?.namespace ?? "default";
          if (svcNs !== ns) continue;
          const selector = service.spec?.selector ?? {};
          if (Object.keys(selector).length === 0) continue;
          if (matches(pod.metadata?.labels, selector)) {
            edges.push({
              id: `svc/${svcNs}/${service.metadata?.name}->pod/${ns}/${name}`,
              source: `svc/${svcNs}/${service.metadata?.name}`,
              target: `pod/${ns}/${name}`,
              animated: true,
              style: { stroke: palette.red },
            });
          }
        }
      }
    });

    return { nodes, edges };
  }, [snapshot, namespace, namespaces]);

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
        const [kind, namespace, ...rest] = node.id.split("/");
        const name = rest.join("/");
        if (!kind || !namespace || !name) return;
        const kindName = kind === "svc" ? "Service" : kind === "deploy" ? "Deployment" : "Pod";
        onSelect({ kind: kindName, name, namespace });
      }}
      style={{ background: palette.panel }}
    >
      <Background color={palette.border} gap={16} />
    </ReactFlow>
  );
}
