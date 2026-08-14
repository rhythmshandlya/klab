"use client";

import { useId, useState } from "react";

import { handleTabKeyDown } from "@/components/ui/tabs";

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

type KubeObject = {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  status?: unknown;
};

function findObject(snapshot: ClusterSnapshot, selected: SelectedObject): KubeObject | undefined {
  const match = (o: KubeObject) =>
    o.metadata?.name === selected.name &&
    (o.metadata?.namespace ?? "default") === selected.namespace;
  const core = (() => {
    switch (selected.kind) {
      case "Pod":
        return snapshot.pods.find(match);
      case "Service":
        return snapshot.services.find(match);
      case "Deployment":
        return snapshot.deployments.find(match);
      case "ReplicaSet":
        return snapshot.replicaSets.find(match);
      case "EndpointSlice":
        return snapshot.endpointSlices.find(match);
      default:
        return undefined;
    }
  })();
  return (
    core ??
    snapshot.resources?.find((resource) => resource.kind === selected.kind && match(resource))
  );
}

export function ObjectDetails({
  snapshot,
  selected,
}: {
  snapshot: ClusterSnapshot;
  selected: SelectedObject | null;
}) {
  const [tab, setTab] = useState<"details" | "yaml">("details");
  const tabsId = useId();

  if (!selected) {
    return (
      <p className="text-subtle p-3 text-sm">
        Select an object in the explorer or topology to inspect it.
      </p>
    );
  }
  const object = findObject(snapshot, selected);
  if (!object) {
    return (
      <p className="text-subtle p-3 text-sm" role="status" aria-live="polite">
        {selected.name} is no longer present.
      </p>
    );
  }
  const activeTabId = `${tabsId}-${tab}-tab`;

  return (
    <div className="flex min-h-0 flex-col">
      <div
        className="border-border flex items-center gap-1 border-b px-2"
        role="tablist"
        aria-label={`${selected.kind} ${selected.name} views`}
      >
        {(["details", "yaml"] as const).map((t) => (
          <button
            key={t}
            id={`${tabsId}-${t}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`${tabsId}-panel`}
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={handleTabKeyDown}
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
      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={activeTabId}
        className="min-h-0 flex-1 overflow-auto p-3"
      >
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
  const generic = snapshot.resources?.some((candidate) => candidate === object) ?? false;
  if (generic) {
    return (
      <div>
        <Row label="Kind" value={selected.kind} />
        <Row label="API version" value={object.apiVersion ?? "<unknown>"} />
        <Row label="Name" value={selected.name} />
        <Row label="Namespace" value={selected.namespace} />
        <LabelList labels={object.metadata?.labels} />
        {object.status !== undefined ? (
          <div className="mt-3">
            <p className="text-subtle mb-1 text-[11px] tracking-wide uppercase">Status</p>
            <pre className="border-border bg-panel-elevated text-muted overflow-x-auto rounded border p-2 font-mono text-[11px] leading-relaxed">
              {stringifyManifest({ status: object.status })}
            </pre>
          </div>
        ) : null}
      </div>
    );
  }
  const inNs = <T extends KubeObject>(o: T) =>
    o.metadata?.name === selected.name &&
    (o.metadata?.namespace ?? "default") === selected.namespace;
  if (selected.kind === "Pod") {
    const pod = snapshot.pods.find(inNs);
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
    const svc = snapshot.services.find(inNs);
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
    const dep = snapshot.deployments.find(inNs);
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
  if (selected.kind === "ReplicaSet") {
    const rs = snapshot.replicaSets.find(inNs);
    if (!rs) return null;
    const ready = rs.status?.readyReplicas ?? 0;
    const desired = rs.spec?.replicas ?? 0;
    const owner = rs.metadata?.ownerReferences?.[0];
    return (
      <div>
        <Row
          label="Ready replicas"
          value={`${ready}/${desired}`}
          tone={ready >= desired ? "ok" : "bad"}
        />
        <Row
          label="Owned by"
          value={owner ? `${owner.kind}/${owner.name}` : "<none> (orphaned)"}
          tone={owner ? undefined : "bad"}
        />
        <LabelList label="Selector" labels={rs.spec?.selector?.matchLabels} />
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
