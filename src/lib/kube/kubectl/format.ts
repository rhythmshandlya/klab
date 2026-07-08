import type {
  CoreV1Event,
  V1Deployment,
  V1EndpointSlice,
  V1Pod,
  V1ReplicaSet,
  V1Service,
} from "@ngrok/webernetes";

/** kubectl-style plain-text formatting helpers. */

/** Render a column table with kubectl-like spacing (min 3 spaces between columns). */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, col) =>
    Math.max(header.length, ...rows.map((row) => (row[col] ?? "").length)),
  );
  const pad = (cells: string[]) =>
    cells
      .map((cell, col) => cell.padEnd(widths[col] ?? cell.length))
      .join("   ")
      .trimEnd();
  return [pad(headers), ...rows.map(pad)].join("\n");
}

/** Humanized age from a creation timestamp, e.g. "8m", "2h", "3d". */
export function humanizeAge(from: string | Date | undefined, nowMs = Date.now()): string {
  if (!from) return "<unknown>";
  const startMs = from instanceof Date ? from.getTime() : Date.parse(from);
  if (Number.isNaN(startMs)) return "<unknown>";
  const seconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function podReadyCounts(pod: V1Pod): { ready: number; total: number } {
  const statuses = pod.status?.containerStatuses ?? [];
  const total = statuses.length || pod.spec?.containers?.length || 0;
  const ready = statuses.filter((c) => c.ready).length;
  return { ready, total };
}

export function podRestarts(pod: V1Pod): number {
  return (pod.status?.containerStatuses ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
}

export function podPhase(pod: V1Pod): string {
  return pod.status?.phase ?? "Unknown";
}

export function isPodReady(pod: V1Pod): boolean {
  const ready = (pod.status?.conditions ?? []).find((c) => c.type === "Ready");
  return ready?.status === "True";
}

export function deploymentReadyReplicas(deployment: V1Deployment): number {
  return deployment.status?.readyReplicas ?? 0;
}

export function replicaSetName(rs: V1ReplicaSet): string {
  return rs.metadata?.name ?? "<unknown>";
}

/** Count ready addresses across a service's endpoint slices. */
export function readyEndpointCount(service: V1Service, slices: V1EndpointSlice[]): number {
  const serviceName = service.metadata?.name;
  const namespace = service.metadata?.namespace;
  let count = 0;
  for (const slice of slices) {
    if (slice.metadata?.namespace !== namespace) continue;
    if (slice.metadata?.labels?.["kubernetes.io/service-name"] !== serviceName) continue;
    for (const endpoint of slice.endpoints ?? []) {
      const ready = endpoint.conditions?.ready !== false;
      const addresses = endpoint.addresses?.length ?? 0;
      if (ready) count += addresses;
    }
  }
  return count;
}

export function servicePortsSummary(service: V1Service): string {
  const ports = service.spec?.ports ?? [];
  if (ports.length === 0) return "<none>";
  return ports
    .map((p) => `${p.port}${p.protocol && p.protocol !== "TCP" ? `/${p.protocol}` : "/TCP"}`)
    .join(",");
}

export function eventAge(event: CoreV1Event): string {
  return humanizeAge(event.lastTimestamp ?? event.eventTime ?? event.metadata?.creationTimestamp);
}
