"use client";

import { isPodReady } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";

/** Summary of the user's resources in a namespace (excludes control-plane pods). */
export function ResourceSummary({
  snapshot,
  namespace = "default",
}: {
  snapshot: ClusterSnapshot;
  namespace?: string;
}) {
  const inNs = <T extends { metadata?: { namespace?: string } }>(items: T[]) =>
    items.filter((i) => (i.metadata?.namespace ?? "default") === namespace);

  const pods = inNs(snapshot.pods);
  const readyPods = pods.filter(isPodReady).length;
  const tiles: { label: string; value: string }[] = [
    { label: "Pods", value: `${readyPods}/${pods.length}` },
    { label: "Services", value: String(inNs(snapshot.services).length) },
    { label: "Deployments", value: String(inNs(snapshot.deployments).length) },
    { label: "ReplicaSets", value: String(inNs(snapshot.replicaSets).length) },
    { label: "EndpointSlices", value: String(inNs(snapshot.endpointSlices).length) },
    { label: "Namespaces", value: String(snapshot.namespaces.length) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {tiles.map((t) => (
        <div key={t.label} className="border-border bg-panel-elevated rounded-md border p-2.5">
          <p className="text-subtle text-[10px] tracking-wide uppercase">{t.label}</p>
          <p className="tabnums text-foreground mt-0.5 text-lg font-semibold">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
