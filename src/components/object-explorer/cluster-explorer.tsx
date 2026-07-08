"use client";

import { icons, type IconName } from "@/components/icons";
import { isPodReady, podPhase } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";

interface Row {
  kind: string;
  name: string;
  icon: IconName;
  ok?: boolean;
}

export function ClusterExplorer({
  snapshot,
  namespace = "default",
  selected,
  onSelect,
}: {
  snapshot: ClusterSnapshot;
  namespace?: string;
  selected: SelectedObject | null;
  onSelect: (object: SelectedObject) => void;
}) {
  const groups: { label: string; rows: Row[] }[] = [
    {
      label: "Deployments",
      rows: snapshot.deployments
        .filter((d) => (d.metadata?.namespace ?? "default") === namespace)
        .map((d) => ({
          kind: "Deployment",
          name: d.metadata?.name ?? "",
          icon: "deployment",
          ok:
            (d.status?.readyReplicas ?? 0) >= (d.spec?.replicas ?? 0) &&
            (d.spec?.replicas ?? 0) > 0,
        })),
    },
    {
      label: "Pods",
      rows: snapshot.pods
        .filter((p) => (p.metadata?.namespace ?? "default") === namespace)
        .map((p) => ({
          kind: "Pod",
          name: p.metadata?.name ?? "",
          icon: "pod",
          ok: isPodReady(p) && podPhase(p) === "Running",
        })),
    },
    {
      label: "Services",
      rows: snapshot.services
        .filter((s) => (s.metadata?.namespace ?? "default") === namespace)
        .map((s) => ({ kind: "Service", name: s.metadata?.name ?? "", icon: "service" })),
    },
    {
      label: "EndpointSlices",
      rows: snapshot.endpointSlices
        .filter((s) => (s.metadata?.namespace ?? "default") === namespace)
        .map((s) => ({
          kind: "EndpointSlice",
          name: s.metadata?.name ?? "",
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
                const isSelected = selected?.kind === row.kind && selected?.name === row.name;
                return (
                  <li key={`${row.kind}/${row.name}`}>
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: row.kind, name: row.name, namespace })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-panel-hover text-foreground"
                          : "text-muted hover:bg-panel-hover hover:text-foreground",
                      )}
                    >
                      <RowIcon icon={row.icon} />
                      <span className="truncate font-mono text-xs">{row.name}</span>
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
