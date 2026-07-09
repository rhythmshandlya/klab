"use client";

import { icons, type IconName } from "@/components/icons";
import { isPodReady, podPhase } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";

interface Row {
  kind: string;
  name: string;
  namespace: string;
  icon: IconName;
  ok?: boolean;
}

export function ClusterExplorer({
  snapshot,
  namespace = "default",
  namespaces,
  selected,
  onSelect,
}: {
  snapshot: ClusterSnapshot;
  /** Single-namespace shorthand (existing callers). */
  namespace?: string;
  /** All namespaces to show; rows get a namespace suffix when more than one. */
  namespaces?: string[];
  selected: SelectedObject | null;
  onSelect: (object: SelectedObject) => void;
}) {
  const nsList = namespaces && namespaces.length > 0 ? namespaces : [namespace];
  const nsSet = new Set(nsList);
  const showNs = nsSet.size > 1;
  const inScope = <T extends { metadata?: { name?: string; namespace?: string } }>(
    items: T[],
  ): T[] => items.filter((item) => nsSet.has(item.metadata?.namespace ?? "default"));

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: "Deployments",
      rows: inScope(snapshot.deployments).map((d) => ({
        kind: "Deployment",
        name: d.metadata?.name ?? "",
        namespace: d.metadata?.namespace ?? "default",
        icon: "deployment",
        ok:
          (d.status?.readyReplicas ?? 0) >= (d.spec?.replicas ?? 0) && (d.spec?.replicas ?? 0) > 0,
      })),
    },
    {
      label: "ReplicaSets",
      rows: inScope(snapshot.replicaSets).map((rs) => ({
        kind: "ReplicaSet",
        name: rs.metadata?.name ?? "",
        namespace: rs.metadata?.namespace ?? "default",
        icon: "deployment",
        ok: (rs.status?.readyReplicas ?? 0) >= (rs.spec?.replicas ?? 0),
      })),
    },
    {
      label: "Pods",
      rows: inScope(snapshot.pods).map((p) => ({
        kind: "Pod",
        name: p.metadata?.name ?? "",
        namespace: p.metadata?.namespace ?? "default",
        icon: "pod",
        ok: isPodReady(p) && podPhase(p) === "Running",
      })),
    },
    {
      label: "Services",
      rows: inScope(snapshot.services).map((s) => ({
        kind: "Service",
        name: s.metadata?.name ?? "",
        namespace: s.metadata?.namespace ?? "default",
        icon: "service",
      })),
    },
    {
      label: "EndpointSlices",
      rows: inScope(snapshot.endpointSlices).map((s) => ({
        kind: "EndpointSlice",
        name: s.metadata?.name ?? "",
        namespace: s.metadata?.namespace ?? "default",
        icon: "endpointSlice",
      })),
    },
  ];

  return (
    <div className="space-y-3 p-2">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-subtle px-2 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
            {group.label}
          </p>
          {group.rows.length === 0 ? (
            <p className="text-subtle/70 px-2 text-xs">—</p>
          ) : (
            <ul>
              {group.rows.map((row) => {
                const isSelected =
                  selected?.kind === row.kind &&
                  selected?.name === row.name &&
                  selected?.namespace === row.namespace;
                return (
                  <li key={`${row.namespace}/${row.kind}/${row.name}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({ kind: row.kind, name: row.name, namespace: row.namespace })
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-panel-hover text-foreground"
                          : "text-muted hover:bg-panel-hover hover:text-foreground",
                      )}
                    >
                      <RowIcon icon={row.icon} />
                      <span className="truncate font-mono text-xs">
                        {row.name}
                        {showNs ? (
                          <span className="text-subtle/80"> · {row.namespace}</span>
                        ) : null}
                      </span>
                      {row.ok !== undefined ? (
                        <span
                          className={cn(
                            "ml-auto size-1.5 shrink-0 rounded-full",
                            row.ok ? "bg-green" : "bg-red",
                          )}
                          aria-label={row.ok ? "ready" : "not ready"}
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function RowIcon({ icon }: { icon: IconName }) {
  const Icon = icons[icon];
  return <Icon className="text-subtle size-3.5 shrink-0" aria-hidden />;
}
