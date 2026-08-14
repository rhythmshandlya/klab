import type { ClusterFixture, FixturePod } from "@/lib/domain/types";

import type { LogLine } from "./images/log-sink";
import type { ClusterSnapshot, ProbeResult } from "./simulator";

/**
 * Renders a declarative `ClusterFixture` (see `domain/types.ts`) into the same
 * `ClusterSnapshot` the real simulator produces, so kubectl, logs, events, topology,
 * and the object explorer all work unchanged against it.
 */

/* -------------------------------------------------------------------------- */

const DEFAULT_START = new Date("2026-08-01T00:00:00Z");

export function renderFixtureSnapshot(fixture: ClusterFixture): ClusterSnapshot {
  const namespace = fixture.namespace;
  const pods = fixture.pods.map((pod) => renderPod(pod, pod.namespace ?? namespace));
  const services = (fixture.services ?? []).map((service) => {
    const serviceNamespace = service.namespace ?? namespace;
    return {
      metadata: {
        name: service.name,
        namespace: serviceNamespace,
        annotations: service.annotations,
      },
      spec: {
        clusterIP: service.clusterIP,
        selector: service.selector,
        type: service.type ?? "ClusterIP",
        ...(service.externalTrafficPolicy
          ? { externalTrafficPolicy: service.externalTrafficPolicy }
          : {}),
        ...(service.publishNotReadyAddresses !== undefined
          ? { publishNotReadyAddresses: service.publishNotReadyAddresses }
          : {}),
        ports: service.ports.map((port) => ({ ...port, protocol: "TCP" })),
      },
    };
  });

  const endpointSlices = (fixture.services ?? []).map((service) => {
    const serviceNamespace = service.namespace ?? namespace;
    return {
      metadata: {
        name: `${service.name}-fixture`,
        namespace: serviceNamespace,
        labels: { "kubernetes.io/service-name": service.name },
      },
      addressType: "IPv4",
      endpoints: fixture.pods
        .filter(
          (pod) =>
            serviceNamespace === (pod.namespace ?? namespace) &&
            (fixturePodReady(pod) || service.publishNotReadyAddresses === true) &&
            pod.podIP &&
            matches(pod.labels, service.selector),
        )
        .map((pod) => ({
          addresses: [pod.podIP],
          conditions: { ready: true },
          targetRef: { name: pod.name },
        })),
      ports: service.ports.map((port) => ({
        name: port.name,
        port:
          typeof port.targetPort === "number"
            ? port.targetPort
            : (resolveNamedTargetPort(
                fixture.pods,
                serviceNamespace,
                namespace,
                service.selector,
                port.targetPort,
              ) ?? port.port),
        protocol: "TCP",
      })),
    };
  });

  const deployments = (fixture.workloads ?? []).map((workload) => {
    const owned = fixture.pods.filter(
      (pod) => (pod.namespace ?? namespace) === namespace && matches(pod.labels, workload.selector),
    );
    const ready = owned.filter(fixturePodReady).length;
    const authored = (fixture.resources ?? []).find(
      (resource) => resource.kind === "Deployment" && resource.metadata.name === workload.name,
    );
    return {
      ...(authored ?? {}),
      metadata: {
        ...(authored?.metadata ?? {}),
        name: workload.name,
        namespace,
      },
      spec: {
        ...objectValue(authored?.spec),
        replicas: workload.replicas,
        selector: { matchLabels: workload.selector },
      },
      status: {
        replicas: owned.length,
        readyReplicas: ready,
        updatedReplicas: owned.length,
        availableReplicas: ready,
        unavailableReplicas: Math.max(0, workload.replicas - ready),
      },
    };
  });

  return {
    pods,
    services,
    deployments,
    replicaSets: [],
    endpointSlices,
    // `default` is always present so namespace-scoped tooling has somewhere to stand.
    namespaces: [
      ...new Set([
        namespace,
        "default",
        ...fixture.pods.map((pod) => pod.namespace ?? namespace),
        ...(fixture.services ?? []).map((service) => service.namespace ?? namespace),
        ...(fixture.resources ?? []).flatMap((resource) =>
          resource.metadata.namespace ? [resource.metadata.namespace] : [],
        ),
      ]),
    ].map((name) => ({ metadata: { name } })),
    nodes: (fixture.nodes ?? [{ name: "node-1" }]).map((node) => ({
      metadata: { name: node.name, labels: node.labels ?? {} },
    })),
    events: (fixture.events ?? []).map((event, index) => ({
      metadata: { name: `${event.reason.toLowerCase()}-${index}`, namespace },
      involvedObject: {
        kind: event.involvedObject?.kind ?? "Pod",
        name: event.involvedObject?.name ?? fixture.pods[0]?.name ?? "unknown",
        namespace,
      },
      type: event.type ?? "Warning",
      reason: event.reason,
      message: event.message,
      lastTimestamp: DEFAULT_START,
    })),
    resources: fixture.resources ?? [],
  } as unknown as ClusterSnapshot;
}

function renderPod(pod: FixturePod, namespace: string): unknown {
  const ready = fixturePodReady(pod);
  return {
    metadata: { name: pod.name, namespace, labels: pod.labels },
    spec: {
      ...(pod.priorityClassName ? { priorityClassName: pod.priorityClassName } : {}),
      ...(pod.priority !== undefined ? { priority: pod.priority } : {}),
      ...(pod.nodeName ? { nodeName: pod.nodeName } : {}),
      ...(pod.terminationGracePeriodSeconds !== undefined
        ? { terminationGracePeriodSeconds: pod.terminationGracePeriodSeconds }
        : {}),
      containers: pod.containers.map((container) => ({
        name: container.name,
        image: container.image,
        ...(container.port ? { ports: [container.port] } : {}),
      })),
    },
    status: {
      phase: pod.phase ?? "Running",
      ...(pod.podIP ? { podIP: pod.podIP } : {}),
      conditions: [
        { type: "Ready", status: ready ? "True" : "False" },
        { type: "ContainersReady", status: ready ? "True" : "False" },
      ],
      containerStatuses: pod.containers.map((container) => ({
        name: container.name,
        image: container.image,
        imageID: container.imageID ?? `fixture://${container.image}`,
        ready: container.ready ?? ready,
        restartCount: container.restartCount ?? 0,
        ...(container.lastTerminationReason
          ? {
              lastState: {
                terminated: {
                  exitCode: 137,
                  reason: container.lastTerminationReason,
                  finishedAt: DEFAULT_START,
                },
              },
            }
          : {}),
        state: container.waitingReason
          ? { waiting: { reason: container.waitingReason, message: container.waitingReason } }
          : pod.phase === "Pending"
            ? { waiting: { reason: "ContainerCreating", message: "Pod is pending" } }
            : pod.phase === "Succeeded" || pod.phase === "Failed"
              ? {
                  terminated: {
                    exitCode: pod.phase === "Succeeded" ? 0 : 1,
                    reason: pod.phase === "Succeeded" ? "Completed" : "Error",
                    finishedAt: DEFAULT_START,
                  },
                }
              : { running: { startedAt: DEFAULT_START } },
      })),
    },
  };
}

export function fixtureLogs(
  fixture: ClusterFixture,
  namespace: string,
  podName: string,
  container?: string,
): LogLine[] {
  const pod = fixture.pods.find(
    (candidate) =>
      candidate.name === podName && (candidate.namespace ?? fixture.namespace) === namespace,
  );
  if (!pod) return [];
  const fallbackContainer = pod.containers[0]?.name ?? "app";
  return (pod.logs ?? [])
    .map((line, index) => ({
      namespace,
      pod: pod.name,
      container: line.container ?? fallbackContainer,
      message: line.message,
      timestampMs: DEFAULT_START.getTime() + index * 1000,
    }))
    .filter((line) => container === undefined || line.container === container);
}

export function fixtureProbe(fixture: ClusterFixture, url: string): ProbeResult {
  const host = hostnameOf(url);
  const service = (fixture.services ?? []).find((candidate) => {
    const serviceNamespace = candidate.namespace ?? fixture.namespace;
    return (
      host === candidate.name ||
      host === `${candidate.name}.${serviceNamespace}` ||
      host === `${candidate.name}.${serviceNamespace}.svc.cluster.local`
    );
  });
  if (!service) {
    return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
  }
  const endpoint = (fixture.endpoints ?? []).find(
    (candidate) => candidate.service === service.name,
  );
  if (!endpoint) {
    return {
      ok: false,
      status: 503,
      body: "no ready endpoints\n",
      reason: "the Service has no ready backends",
    };
  }
  return {
    ok: endpoint.status >= 200 && endpoint.status < 400,
    status: endpoint.status,
    body: endpoint.body,
    ...(endpoint.reason ? { reason: endpoint.reason } : {}),
  };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function matches(labels: Record<string, string>, selector: Record<string, string>): boolean {
  return Object.entries(selector).every(([key, value]) => labels[key] === value);
}

function fixturePodReady(pod: FixturePod): boolean {
  if (pod.ready !== undefined) return pod.ready;
  return (
    (pod.phase ?? "Running") === "Running" &&
    pod.containers.every(
      (container) => container.ready !== false && container.waitingReason === undefined,
    )
  );
}

function resolveNamedTargetPort(
  pods: FixturePod[],
  serviceNamespace: string,
  fixtureNamespace: string,
  selector: Record<string, string>,
  name: string,
): number | undefined {
  for (const pod of pods) {
    if ((pod.namespace ?? fixtureNamespace) !== serviceNamespace) continue;
    if (!matches(pod.labels, selector)) continue;
    for (const container of pod.containers) {
      if (container.port?.name === name) return container.port.containerPort;
    }
  }
  return undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
