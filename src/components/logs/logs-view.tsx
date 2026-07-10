"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { logSink, type LogLine } from "@/lib/kube/images/log-sink";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { cn } from "@/lib/utils/cn";

/**
 * Structured log viewer: one row per line with timestamp, source pod, and message —
 * plus quick filters (All / HTTP / Errors, and per-pod). Subscribes to the shared
 * log sink so new lines stream in live.
 */

type LineFilter = "all" | "http" | "errors";

const HTTP_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD) \//;
const ERROR_RE = /fatal|error|fail|panic|refused|exiting/i;

const FILTERS: { id: LineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "http", label: "HTTP" },
  { id: "errors", label: "Errors" },
];

function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function LogsView({
  snapshot,
  onInspect,
}: {
  snapshot: ClusterSnapshot;
  onInspect?: (lines: readonly LogLine[]) => void;
}) {
  const [filter, setFilter] = useState<LineFilter>("all");
  const [podFilter, setPodFilter] = useState<string>("all");
  const [containerFilter, setContainerFilter] = useState<string>("all");
  // Re-render when new log lines land (the sink is imperative, outside React).
  const [, setLogTick] = useState(0);
  useEffect(() => logSink.subscribe(() => setLogTick((t) => t + 1)), []);

  const pods = useMemo(
    () =>
      snapshot.pods
        .map((p) => ({
          name: p.metadata?.name ?? "",
          namespace: p.metadata?.namespace ?? "default",
          containers: (p.spec?.containers ?? []).map((container) => container.name),
        }))
        // Control-plane (kube-*) pods never write to the klab log sink — skip them.
        .filter((p) => p.name !== "" && !p.namespace.startsWith("kube-")),
    [snapshot.pods],
  );

  const containers = useMemo(() => {
    const selectedPods = podFilter === "all" ? pods : pods.filter((pod) => pod.name === podFilter);
    return [...new Set(selectedPods.flatMap((pod) => pod.containers))].sort();
  }, [podFilter, pods]);

  // Computed inline (not memoized): the log tick re-renders this component when new
  // lines land, and the recompute over an in-memory buffer is cheap.
  const all: LogLine[] = [];
  for (const pod of pods) {
    all.push(...logSink.forPod(pod.namespace, pod.name));
  }
  all.sort((a, b) => a.timestampMs - b.timestampMs);
  const lines = all.filter((line) => {
    if (podFilter !== "all" && line.pod !== podFilter) return false;
    if (containerFilter !== "all" && line.container !== containerFilter) return false;
    if (filter === "http") return HTTP_RE.test(line.message);
    if (filter === "errors") return ERROR_RE.test(line.message);
    return true;
  });

  const inspectedKey = lines
    .map(
      (line) =>
        `${line.timestampMs}:${line.namespace}:${line.pod}:${line.container}:${line.message}`,
    )
    .join("\n");
  const lastInspectedRef = useRef("");
  useEffect(() => {
    if (!onInspect || inspectedKey === lastInspectedRef.current) return;
    lastInspectedRef.current = inspectedKey;
    onInspect(lines);
  }, [inspectedKey, lines, onInspect]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
              filter === f.id
                ? "border-blue/40 bg-blue/10 text-blue"
                : "border-border bg-panel-elevated text-subtle hover:text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
        <select
          value={podFilter}
          onChange={(e) => {
            setPodFilter(e.target.value);
            setContainerFilter("all");
          }}
          aria-label="Filter logs by pod"
          className="border-border bg-panel-elevated text-muted ml-auto h-6 rounded-md border px-1.5 text-[11px]"
        >
          <option value="all">All pods</option>
          {pods.map((pod) => (
            <option key={`${pod.namespace}/${pod.name}`} value={pod.name}>
              {pod.name}
            </option>
          ))}
        </select>
        {containers.length > 1 ? (
          <select
            value={containerFilter}
            onChange={(event) => setContainerFilter(event.target.value)}
            aria-label="Filter logs by container"
            className="border-border bg-panel-elevated text-muted h-6 rounded-md border px-1.5 text-[11px]"
          >
            <option value="all">All containers</option>
            {containers.map((container) => (
              <option key={container} value={container}>
                {container}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs">
        {lines.length === 0 ? (
          <p className="text-subtle p-2 font-sans">
            No log lines match. Pods log as they start, serve probes, and handle requests.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, index) => {
                const isError = ERROR_RE.test(line.message);
                return (
                  <tr key={index} className="align-top">
                    <td className="text-subtle w-16 pr-3 whitespace-nowrap">
                      {formatTime(line.timestampMs)}
                    </td>
                    <td className="text-blue/80 w-48 max-w-48 truncate pr-3">
                      {line.pod}/{line.container}
                    </td>
                    <td className={cn("pr-2 break-all", isError ? "text-red" : "text-muted")}>
                      {line.message}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
