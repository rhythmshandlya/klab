"use client";

import { useState } from "react";

import {
  isPodReady,
  podPhase,
  readyEndpointCount,
  servicePortsSummary,
} from "@/lib/kube/kubectl/format";
import { stringifyManifest } from "@/lib/kube/manifest-parser";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";

type KubeObject = { metadata?: { name?: string; namespace?: string } };

function findObject(snapshot: ClusterSnapshot, selected: SelectedObject): KubeObject | undefined {
  const match = (o: KubeObject) =>
    o.metadata?.name === selected.name &&
    (o.metadata?.namespace ?? "default") === selected.namespace;
  switch (selected.kind) {
    case "Pod":
      return snapshot.pods.find(match);
    case "Service":
      return snapshot.services.find(match);
    case "Deployment":
      return snapshot.deployments.find(match);
    case "EndpointSlice":
      return snapshot.endpointSlices.find(match);
    default:
      return undefined;
  }
}

export function ObjectDetails({
  snapshot,
  selected,
}: {
  snapshot: ClusterSnapshot;
  selected: SelectedObject | null;
}) {
  const [tab, setTab] = useState<"details" | "yaml">("details");

  if (!selected) {
    return (
      <p className="text-subtle p-3 text-sm">
        Select an object in the explorer or topology to inspect it.
      </p>
    );
  }
  const object = findObject(snapshot, selected);
  if (!object) {
    return <p className="text-subtle p-3 text-sm">{selected.name} is no longer present.</p>;
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-border flex items-center gap-1 border-b px-2">
        {(["details", "yaml"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-medium capitalize transition-colors",
              tab === t ? "text-foreground" : "text-subtle hover:text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === "details" ? (
          <Details snapshot={snapshot} selected={selected} object={object} />
        ) : (
          <pre className="text-muted overflow-x-auto font-mono text-[11px] leading-relaxed">
            {stringifyManifest(object)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-subtle">{label}</span>
      <span
        className={cn(
          "font-mono text-xs",
          tone === "ok" ? "text-green" : tone === "bad" ? "text-red" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Details({
  snapshot,
  selected,
  object,
}: {
  snapshot: ClusterSnapshot;
  selected: SelectedObject;
  object: KubeObject;
}) {
  if (selected.kind === "Pod") {
    const pod = snapshot.pods.find((p) => p.metadata?.name === selected.name);
    if (!pod) return null;
    const ready = isPodReady(pod);
    return (
      <div>
        <Row label="Phase" value={podPhase(pod)} />
        <Row label="Ready" value={ready ? "True" : "False"} tone={ready ? "ok" : "bad"} />
        <Row label="Pod IP" value={pod.status?.podIP ?? "<none>"} />
        <Row label="Node" value={pod.spec?.nodeName ?? "<none>"} />
        <LabelList labels={pod.metadata?.labels} />
      </div>
    );
  }
  if (selected.kind === "Service") {
    const svc = snapshot.services.find((s) => s.metadata?.name === selected.name);
    if (!svc) return null;
    const endpoints = readyEndpointCount(svc, snapshot.endpointSlices);
    return (
      <div>
        <Row label="Type" value={svc.spec?.type ?? "ClusterIP"} />
        <Row label="Cluster IP" value={svc.spec?.clusterIP ?? "<none>"} />
        <Row label="Ports" value={servicePortsSummary(svc)} />
        <Row
          label="Ready endpoints"
          value={String(endpoints)}
          tone={endpoints > 0 ? "ok" : "bad"}
        />
        <LabelList label="Selector" labels={svc.spec?.selector} />
      </div>
    );
  }
  if (selected.kind === "Deployment") {
    const dep = snapshot.deployments.find((d) => d.metadata?.name === selected.name);
    if (!dep) return null;
    const ready = dep.status?.readyReplicas ?? 0;
    const desired = dep.spec?.replicas ?? 0;
    return (
      <div>
        <Row
          label="Ready replicas"
          value={`${ready}/${desired}`}
          tone={ready >= desired && desired > 0 ? "ok" : "bad"}
        />
        <Row label="Updated" value={String(dep.status?.updatedReplicas ?? 0)} />
        <LabelList label="Selector" labels={dep.spec?.selector?.matchLabels} />
      </div>
    );
  }
  return (
    <pre className="text-muted overflow-x-auto font-mono text-[11px]">
      {stringifyManifest(object)}
    </pre>
  );
}

function LabelList({
  label = "Labels",
  labels,
}: {
  label?: string;
  labels?: Record<string, string>;
}) {
  const entries = Object.entries(labels ?? {});
  return (
    <div className="mt-2">
      <p className="text-subtle mb-1 text-[11px] tracking-wide uppercase">{label}</p>
      {entries.length === 0 ? (
        <span className="text-subtle text-xs">&lt;none&gt;</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {entries.map(([k, v]) => (
            <span
              key={k}
              className="border-border bg-panel-elevated text-muted rounded border px-1.5 py-0.5 font-mono text-[10px]"
            >
              {k}={v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
