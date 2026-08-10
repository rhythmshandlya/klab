import type { ProblemCapability } from "@/lib/domain/types";
import { err, ok, type Result } from "@/lib/utils/result";

import type { LogLine } from "./images/log-sink";
import type { ParsedManifest } from "./manifest-parser";
import type { AppliedResourceRef, ClusterSnapshot, ProbeResult } from "./simulator";

export interface ScriptedScenarioRuntime {
  readonly capabilities: ReadonlySet<ProblemCapability>;
  boot(): Result<AppliedResourceRef[], string>;
  snapshot(): ClusterSnapshot;
  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string>;
  probe(url: string): ProbeResult;
  logs(namespace: string, pod: string, container?: string): LogLine[];
}

const PRIVATE_REGISTRY_CAPABILITIES = new Set<ProblemCapability>([
  "pods",
  "services",
  "deployments",
  "events",
  "http-probes",
  "image-pulls",
  "secrets",
]);

const GRACEFUL_SHUTDOWN_CAPABILITIES = new Set<ProblemCapability>([
  "pods",
  "services",
  "deployments",
  "replicasets",
  "events",
  "logs",
  "http-probes",
  "rollouts",
  "container-lifecycle",
]);

const RECREATE_OUTAGE_CAPABILITIES = new Set<ProblemCapability>([
  "pods",
  "services",
  "deployments",
  "replicasets",
  "events",
  "logs",
  "http-probes",
  "rollouts",
  "container-lifecycle",
]);

const ROLLOUT_MAXSURGE_CAPABILITIES = new Set<ProblemCapability>([
  "pods",
  "services",
  "deployments",
  "replicasets",
  "events",
  "http-probes",
  "rollouts",
  "scheduling",
]);

const IMMUTABLE_SELECTOR_CAPABILITIES = new Set<ProblemCapability>([
  "pods",
  "services",
  "deployments",
  "events",
  "http-probes",
  "rollouts",
]);

const CAPABILITIES: Readonly<Record<string, ReadonlySet<ProblemCapability>>> = {
  "private-registry-pull": PRIVATE_REGISTRY_CAPABILITIES,
  "graceful-shutdown-502": GRACEFUL_SHUTDOWN_CAPABILITIES,
  "recreate-strategy-outage": RECREATE_OUTAGE_CAPABILITIES,
  "rollout-maxsurge-capacity": ROLLOUT_MAXSURGE_CAPABILITIES,
  "immutable-selector": IMMUTABLE_SELECTOR_CAPABILITIES,
};

export function scriptedScenarioCapabilities(scenarioId: string): ReadonlySet<ProblemCapability> {
  return CAPABILITIES[scenarioId] ?? new Set();
}

export function createScriptedScenarioRuntime(
  scenarioId: string,
): ScriptedScenarioRuntime | undefined {
  if (scenarioId === "private-registry-pull") return new PrivateRegistryScenario();
  if (scenarioId === "graceful-shutdown-502") return new GracefulShutdownScenario();
  if (scenarioId === "recreate-strategy-outage") return new RecreateStrategyScenario();
  if (scenarioId === "rollout-maxsurge-capacity") return new RolloutMaxSurgeScenario();
  if (scenarioId === "immutable-selector") return new ImmutableSelectorScenario();
  return undefined;
}

export function emptyScriptedSnapshot(): ClusterSnapshot {
  return {
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    endpointSlices: [],
    namespaces: [],
    nodes: [],
    events: [],
  };
}

class PrivateRegistryScenario implements ScriptedScenarioRuntime {
  readonly capabilities = PRIVATE_REGISTRY_CAPABILITIES;
  private fixed = false;

  boot(): Result<AppliedResourceRef[], string> {
    this.fixed = false;
    return ok([
      { kind: "Deployment", name: "private-api", namespace: "default" },
      { kind: "Service", name: "private-api-svc", namespace: "default" },
    ]);
  }

  snapshot(): ClusterSnapshot {
    return privateRegistrySnapshot(this.fixed);
  }

  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string> {
    const deployment = manifests.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "private-api",
    );
    if (!deployment) return err("The private-api Deployment is missing.");
    const template = objectAt(deployment.raw, "spec.template.spec");
    const pullSecrets = Array.isArray(template?.imagePullSecrets) ? template.imagePullSecrets : [];
    this.fixed = pullSecrets.some((entry) => objectAt(entry, "")?.name === "registry-credentials");
    return ok([{ kind: "Deployment", name: "private-api", namespace: "default" }]);
  }

  probe(url: string): ProbeResult {
    const host = safeHostname(url);
    if (host !== "private-api-svc" && host !== "private-api-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    return this.fixed
      ? { ok: true, status: 200, body: "private api ready\n" }
      : { ok: false, status: 503, body: "no ready endpoints\n", reason: "ImagePullBackOff" };
  }

  logs(namespace: string, pod: string): LogLine[] {
    if (namespace !== "default" || pod !== "private-api-6f4d9" || !this.fixed) return [];
    return [scriptedLog(pod, "api", "server listening on :8080")];
  }
}

class GracefulShutdownScenario implements ScriptedScenarioRuntime {
  readonly capabilities = GRACEFUL_SHUTDOWN_CAPABILITIES;
  private fixed = false;
  private probeIndex = 0;

  boot(): Result<AppliedResourceRef[], string> {
    this.fixed = false;
    this.probeIndex = 0;
    return ok([
      { kind: "Deployment", name: "edge-api", namespace: "default" },
      { kind: "Service", name: "edge-api-svc", namespace: "default" },
    ]);
  }

  snapshot(): ClusterSnapshot {
    return gracefulShutdownSnapshot(this.fixed);
  }

  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string> {
    const deployment = manifests.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "edge-api",
    );
    if (!deployment) return err("The edge-api Deployment is missing.");

    const podSpec = objectAt(deployment.raw, "spec.template.spec");
    const grace = Number(podSpec?.terminationGracePeriodSeconds ?? 0);
    const containers = Array.isArray(podSpec?.containers) ? podSpec.containers : [];
    const container = objectAt(containers[0], "");
    const command = valueAt(container, "lifecycle.preStop.exec.command");
    const hasDrainDelay =
      Array.isArray(command) && command.some((part) => String(part).match(/^sleep\s+10$/));
    this.fixed = grace >= 15 && hasDrainDelay;
    this.probeIndex = 0;
    return ok([{ kind: "Deployment", name: "edge-api", namespace: "default" }]);
  }

  probe(url: string): ProbeResult {
    const host = safeHostname(url);
    if (host !== "edge-api-svc" && host !== "edge-api-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    this.probeIndex += 1;
    if (!this.fixed && this.probeIndex % 3 === 0) {
      return {
        ok: false,
        status: 502,
        body: "backend=edge-api-old state=terminating listener=closed\n",
        reason: "Ingress still routed to a terminating endpoint",
      };
    }
    return {
      ok: true,
      status: 200,
      body: `backend=${this.fixed ? "edge-api-new" : "edge-api-new-a"} status=ok\n`,
    };
  }

  logs(namespace: string, pod: string, container?: string): LogLine[] {
    if (namespace !== "default" || (container && container !== "api")) return [];
    if (pod === "edge-api-old") {
      return [
        scriptedLog(pod, "api", "SIGTERM received; closing listener immediately"),
        scriptedLog(pod, "api", "existing connections drained; process awaiting termination"),
      ];
    }
    if (pod.startsWith("edge-api-new")) {
      return [scriptedLog(pod, "api", "edge-api listening on :8080")];
    }
    return [];
  }
}

/**
 * Problem 20 — Recreate Strategy Outage. A Recreate rollout terminated every old pod
 * before the new release passed readiness, so the Service has zero ready endpoints.
 * Switching to RollingUpdate (maxUnavailable 0) lets the controller keep old pods
 * serving until the new ones are Ready.
 */
class RecreateStrategyScenario implements ScriptedScenarioRuntime {
  readonly capabilities = RECREATE_OUTAGE_CAPABILITIES;
  private fixed = false;

  boot(): Result<AppliedResourceRef[], string> {
    this.fixed = false;
    return ok([
      { kind: "Deployment", name: "checkout", namespace: "default" },
      { kind: "Service", name: "checkout-svc", namespace: "default" },
    ]);
  }

  snapshot(): ClusterSnapshot {
    return recreateOutageSnapshot(this.fixed);
  }

  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string> {
    const deployment = manifests.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "checkout",
    );
    if (!deployment) return err("The checkout Deployment is missing.");
    const strategy = valueAt(deployment.raw, "spec.strategy.type");
    const rollingUpdate = objectAt(deployment.raw, "spec.strategy.rollingUpdate");
    const maxUnavailable = rollingUpdate ? valueAt(rollingUpdate, "maxUnavailable") : undefined;
    this.fixed = strategy === "RollingUpdate" && (maxUnavailable === 0 || maxUnavailable === "0");
    return ok([{ kind: "Deployment", name: "checkout", namespace: "default" }]);
  }

  probe(url: string): ProbeResult {
    const host = safeHostname(url);
    if (host !== "checkout-svc" && host !== "checkout-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    return this.fixed
      ? { ok: true, status: 200, body: "checkout api ready\n" }
      : {
          ok: false,
          status: 503,
          body: "no ready endpoints\n",
          reason: "Recreate rollout terminated every pod before the new release was Ready",
        };
  }

  logs(namespace: string, pod: string, container?: string): LogLine[] {
    if (namespace !== "default" || (container && container !== "api")) return [];
    if (this.fixed && pod.startsWith("checkout-")) {
      return [scriptedLog(pod, "api", "checkout api listening on :8080")];
    }
    if (!this.fixed && pod.startsWith("checkout-new")) {
      return [
        scriptedLog(pod, "api", "starting up; readiness probe not yet passing"),
        scriptedLog(pod, "api", "old replicas already terminated by Recreate strategy"),
      ];
    }
    return [];
  }
}

/**
 * Problem 19 — Rollout Cannot Fit maxSurge. The cluster has only enough capacity for
 * the desired replica count. With maxSurge>0 the controller tries to create extra
 * surge pods that cannot schedule (Pending, Insufficient cpu), and maxUnavailable:0
 * prevents it from freeing room, so the new release never lands. Setting maxSurge:0
 * with maxUnavailable:1 lets the controller roll within existing capacity.
 */
class RolloutMaxSurgeScenario implements ScriptedScenarioRuntime {
  readonly capabilities = ROLLOUT_MAXSURGE_CAPABILITIES;
  private fixed = false;

  boot(): Result<AppliedResourceRef[], string> {
    this.fixed = false;
    return ok([
      { kind: "Deployment", name: "analytics", namespace: "default" },
      { kind: "Service", name: "analytics-svc", namespace: "default" },
    ]);
  }

  snapshot(): ClusterSnapshot {
    return rolloutMaxSurgeSnapshot(this.fixed);
  }

  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string> {
    const deployment = manifests.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "analytics",
    );
    if (!deployment) return err("The analytics Deployment is missing.");
    const strategy = valueAt(deployment.raw, "spec.strategy.type");
    const rollingUpdate = objectAt(deployment.raw, "spec.strategy.rollingUpdate");
    const maxSurge = rollingUpdate ? valueAt(rollingUpdate, "maxSurge") : undefined;
    const maxUnavailable = rollingUpdate ? valueAt(rollingUpdate, "maxUnavailable") : undefined;
    const surgeFits = maxSurge === 0 || maxSurge === "0";
    const maxUnavailableNum =
      typeof maxUnavailable === "number" ? maxUnavailable : Number(maxUnavailable);
    const allowsRoom = !Number.isNaN(maxUnavailableNum) && maxUnavailableNum >= 1;
    this.fixed =
      (strategy === undefined || strategy === "RollingUpdate") && surgeFits && allowsRoom;
    return ok([{ kind: "Deployment", name: "analytics", namespace: "default" }]);
  }

  probe(url: string): ProbeResult {
    const host = safeHostname(url);
    if (host !== "analytics-svc" && host !== "analytics-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    return this.fixed
      ? { ok: true, status: 200, body: "analytics v2 ready\n" }
      : {
          ok: false,
          status: 500,
          body: "analytics v1 internal error\n",
          reason: "v1 is serving 500",
        };
  }

  logs(namespace: string, pod: string, container?: string): LogLine[] {
    if (namespace !== "default" || (container && container !== "api")) return [];
    if (this.fixed && pod.startsWith("analytics-")) {
      return [scriptedLog(pod, "api", "analytics v2 listening on :8080")];
    }
    if (!this.fixed && pod.startsWith("analytics-old")) {
      return [scriptedLog(pod, "api", "analytics v1 internal error: dependency schema mismatch")];
    }
    return [];
  }
}

/**
 * Problem 21 — Immutable Deployment Selector. The Service now selects pods carrying
 * `tier: api`, but the pods lack that label. A teammate tried to add it through the
 * Deployment selector, which the API rejects (selectors are immutable). The safe fix
 * is to leave the selector alone and add `tier: api` to the pod template labels.
 */
class ImmutableSelectorScenario implements ScriptedScenarioRuntime {
  readonly capabilities = IMMUTABLE_SELECTOR_CAPABILITIES;
  private fixed = false;

  boot(): Result<AppliedResourceRef[], string> {
    return ok([
      { kind: "Deployment", name: "search", namespace: "default" },
      { kind: "Service", name: "search-svc", namespace: "default" },
    ]);
  }

  snapshot(): ClusterSnapshot {
    return immutableSelectorSnapshot(this.fixed);
  }

  apply(manifests: readonly ParsedManifest[]): Result<AppliedResourceRef[], string> {
    const deployment = manifests.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "search",
    );
    if (!deployment) return err("The search Deployment is missing.");
    const selector = objectAt(deployment.raw, "spec.selector.matchLabels");
    const selectorKeys = selector ? Object.keys(selector) : [];
    const selectorChanged =
      selectorKeys.length !== 1 || (selector as Record<string, unknown>)?.app !== "search";
    if (selectorChanged) {
      return err(
        'The Deployment "search" is invalid: spec.selector: Invalid value: field is immutable',
      );
    }
    const templateLabels = objectAt(deployment.raw, "spec.template.metadata.labels");
    this.fixed =
      (templateLabels as Record<string, unknown>)?.app === "search" &&
      (templateLabels as Record<string, unknown>)?.tier === "api";
    return ok([{ kind: "Deployment", name: "search", namespace: "default" }]);
  }

  probe(url: string): ProbeResult {
    const host = safeHostname(url);
    if (host !== "search-svc" && host !== "search-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    return this.fixed
      ? { ok: true, status: 200, body: "search api ready\n" }
      : {
          ok: false,
          status: 503,
          body: "no ready endpoints\n",
          reason: "No pods carry the tier: api label the Service selects",
        };
  }

  logs(_namespace: string, _pod: string, _container?: string): LogLine[] {
    return [];
  }
}

function privateRegistrySnapshot(fixed: boolean): ClusterSnapshot {
  const podName = "private-api-6f4d9";
  const pod = {
    metadata: { name: podName, namespace: "default", labels: { app: "private-api" } },
    spec: {
      nodeName: "node-1",
      containers: [{ name: "api", image: "registry.example/private/api:1.0.0" }],
    },
    status: {
      phase: fixed ? "Running" : "Pending",
      podIP: fixed ? "10.0.0.21" : undefined,
      conditions: [{ type: "Ready", status: fixed ? "True" : "False" }],
      containerStatuses: [
        {
          name: "api",
          image: "registry.example/private/api:1.0.0",
          imageID: fixed ? "scripted://private-api-1.0.0" : "",
          ready: fixed,
          restartCount: 0,
          state: fixed
            ? { running: { startedAt: new Date("2026-07-10T00:00:00Z") } }
            : { waiting: { reason: "ImagePullBackOff", message: "pull access denied" } },
        },
      ],
    },
  };
  const service = {
    metadata: { name: "private-api-svc", namespace: "default" },
    spec: {
      clusterIP: "10.96.0.90",
      selector: { app: "private-api" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  };
  return {
    pods: [pod],
    services: [service],
    deployments: [
      {
        metadata: { name: "private-api", namespace: "default" },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: "private-api" } },
          template: pod,
        },
        status: { replicas: 1, readyReplicas: fixed ? 1 : 0, unavailableReplicas: fixed ? 0 : 1 },
      },
    ],
    replicaSets: [],
    endpointSlices: [
      {
        metadata: {
          name: "private-api-svc-scripted",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "private-api-svc" },
        },
        addressType: "IPv4",
        endpoints: fixed
          ? [
              {
                addresses: ["10.0.0.21"],
                conditions: { ready: true },
                targetRef: { name: podName },
              },
            ]
          : [],
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ],
    namespaces: [{ metadata: { name: "default" } }],
    nodes: [{ metadata: { name: "node-1" } }],
    events: fixed
      ? []
      : [
          {
            metadata: { name: "private-api-pull", namespace: "default" },
            type: "Warning",
            reason: "Failed",
            message:
              "Failed to pull image registry.example/private/api:1.0.0: secret registry-credentials not found",
          },
        ],
  } as unknown as ClusterSnapshot;
}

function gracefulShutdownSnapshot(fixed: boolean): ClusterSnapshot {
  const newPods = [
    scriptedRunningPod("edge-api-new-a", "10.0.0.31", "new"),
    scriptedRunningPod("edge-api-new-b", "10.0.0.32", "new"),
  ];
  const oldPod = scriptedRunningPod("edge-api-old", "10.0.0.30", "old", true);
  const pods = fixed ? newPods : [oldPod, ...newPods];
  const endpoints = pods.map((pod) => ({
    addresses: [pod.status.podIP],
    conditions: { ready: true, terminating: pod.metadata.deletionTimestamp !== undefined },
    targetRef: { name: pod.metadata.name },
  }));
  const service = {
    metadata: { name: "edge-api-svc", namespace: "default" },
    spec: {
      clusterIP: "10.96.0.91",
      selector: { app: "edge-api" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  };

  return {
    pods,
    services: [service],
    deployments: [
      {
        metadata: { name: "edge-api", namespace: "default" },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: "edge-api" } },
          template: { metadata: { labels: { app: "edge-api", release: "new" } } },
        },
        status: { replicas: fixed ? 2 : 3, readyReplicas: fixed ? 2 : 3, updatedReplicas: 2 },
      },
    ],
    replicaSets: [
      scriptedReplicaSet("edge-api-old-rs", "old", fixed ? 0 : 1),
      scriptedReplicaSet("edge-api-new-rs", "new", 2),
    ],
    endpointSlices: [
      {
        metadata: {
          name: "edge-api-svc-scripted",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "edge-api-svc" },
        },
        addressType: "IPv4",
        endpoints,
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ],
    namespaces: [{ metadata: { name: "default" } }],
    nodes: [{ metadata: { name: "node-1" } }, { metadata: { name: "node-2" } }],
    events: fixed
      ? []
      : [
          {
            metadata: { name: "edge-api-terminating", namespace: "default" },
            involvedObject: { kind: "Pod", name: "edge-api-old", namespace: "default" },
            type: "Normal",
            reason: "Killing",
            message:
              "Stopping container api while external load-balancer endpoint removal is pending",
          },
        ],
  } as unknown as ClusterSnapshot;
}

function recreateOutageSnapshot(fixed: boolean): ClusterSnapshot {
  const image = "klab/checkout:2.1.0";
  const podSpec = (name: string, ready: boolean, podIP: string | undefined) => ({
    metadata: { name, namespace: "default", labels: { app: "checkout" } },
    spec: {
      nodeName: "node-1",
      containers: [{ name: "api", image, ports: [{ name: "http", containerPort: 8080 }] }],
    },
    status: {
      phase: "Running",
      podIP,
      conditions: [
        { type: "Ready", status: ready ? "True" : "False" },
        { type: "ContainersReady", status: ready ? "True" : "False" },
      ],
      containerStatuses: [
        {
          name: "api",
          image,
          imageID: "scripted://checkout-2.1.0",
          ready,
          restartCount: 0,
          state: { running: { startedAt: new Date("2026-07-10T00:00:00Z") } },
        },
      ],
    },
  });
  const pods = fixed
    ? [podSpec("checkout-a", true, "10.0.0.41"), podSpec("checkout-b", true, "10.0.0.42")]
    : [podSpec("checkout-new-a", false, undefined), podSpec("checkout-new-b", false, undefined)];
  const readyPods = pods.filter((pod) => pod.status.conditions[0]?.status === "True");
  const endpoints = readyPods.map((pod) => ({
    addresses: [pod.status.podIP],
    conditions: { ready: true },
    targetRef: { name: pod.metadata.name },
  }));
  const service = {
    metadata: { name: "checkout-svc", namespace: "default" },
    spec: {
      clusterIP: "10.96.0.93",
      selector: { app: "checkout" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  };
  return {
    pods,
    services: [service],
    deployments: [
      {
        metadata: { name: "checkout", namespace: "default" },
        spec: {
          replicas: 2,
          strategy: fixed
            ? { type: "RollingUpdate", rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } }
            : { type: "Recreate" },
          selector: { matchLabels: { app: "checkout" } },
          template: { metadata: { labels: { app: "checkout" } } },
        },
        status: {
          replicas: 2,
          readyReplicas: fixed ? 2 : 0,
          updatedReplicas: 2,
          unavailableReplicas: fixed ? 0 : 2,
        },
      },
    ],
    replicaSets: [
      {
        metadata: {
          name: fixed ? "checkout-7d9c1-rs" : "checkout-7d9c1-newrs",
          namespace: "default",
          labels: { app: "checkout" },
        },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: "checkout" } },
          template: { metadata: { labels: { app: "checkout" } } },
        },
        status: { replicas: 2, readyReplicas: fixed ? 2 : 0, availableReplicas: fixed ? 2 : 0 },
      },
    ],
    endpointSlices: [
      {
        metadata: {
          name: "checkout-svc-scripted",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "checkout-svc" },
        },
        addressType: "IPv4",
        endpoints,
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ],
    namespaces: [{ metadata: { name: "default" } }],
    nodes: [{ metadata: { name: "node-1" } }, { metadata: { name: "node-2" } }],
    events: fixed
      ? []
      : [
          {
            metadata: { name: "checkout-scaling", namespace: "default" },
            type: "Normal",
            reason: "ScalingReplicaSet",
            message: "Scaled down replica set checkout-5f2a1-oldrs to 0 (Recreate strategy)",
          },
        ],
  } as unknown as ClusterSnapshot;
}

function rolloutMaxSurgeSnapshot(fixed: boolean): ClusterSnapshot {
  const readyPod = (
    name: string,
    podIP: string,
    image: string,
    labels: Record<string, string>,
  ) => ({
    metadata: { name, namespace: "default", labels },
    spec: {
      nodeName: "node-1",
      containers: [
        {
          name: "api",
          image,
          ports: [{ name: "http", containerPort: 8080 }],
          resources: { requests: { cpu: "2" }, limits: { cpu: "2" } },
        },
      ],
    },
    status: {
      phase: "Running",
      podIP,
      conditions: [{ type: "Ready", status: "True" }],
      containerStatuses: [
        {
          name: "api",
          image,
          imageID: `scripted://${image}`,
          ready: true,
          restartCount: 0,
          state: { running: { startedAt: new Date("2026-07-10T00:00:00Z") } },
        },
      ],
    },
  });
  const pendingPod = (name: string) => ({
    metadata: { name, namespace: "default", labels: { app: "analytics", track: "v2" } },
    spec: {
      nodeName: undefined,
      containers: [
        {
          name: "api",
          image: "klab/analytics:2.0.0",
          ports: [{ name: "http", containerPort: 8080 }],
          resources: { requests: { cpu: "2" }, limits: { cpu: "2" } },
        },
      ],
    },
    status: {
      phase: "Pending",
      podIP: undefined as string | undefined,
      conditions: [{ type: "PodScheduled", status: "False" }],
      containerStatuses: [],
    },
  });
  const pods = fixed
    ? [
        readyPod("analytics-a", "10.0.0.51", "klab/analytics:2.0.0", {
          app: "analytics",
          track: "v2",
        }),
        readyPod("analytics-b", "10.0.0.52", "klab/analytics:2.0.0", {
          app: "analytics",
          track: "v2",
        }),
      ]
    : [
        readyPod("analytics-old-a", "10.0.0.53", "klab/analytics:1.0.0", {
          app: "analytics",
          track: "v1",
        }),
        readyPod("analytics-old-b", "10.0.0.54", "klab/analytics:1.0.0", {
          app: "analytics",
          track: "v1",
        }),
        pendingPod("analytics-new-a"),
        pendingPod("analytics-new-b"),
      ];
  const readyPods = pods.filter((pod) => pod.status.phase === "Running");
  const endpoints = readyPods.map((pod) => ({
    addresses: [pod.status.podIP],
    conditions: { ready: true },
    targetRef: { name: pod.metadata.name },
  }));
  const service = {
    metadata: { name: "analytics-svc", namespace: "default" },
    spec: {
      clusterIP: "10.96.0.94",
      selector: { app: "analytics" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  };
  return {
    pods,
    services: [service],
    deployments: [
      {
        metadata: { name: "analytics", namespace: "default" },
        spec: {
          replicas: 2,
          strategy: fixed
            ? { type: "RollingUpdate", rollingUpdate: { maxSurge: 0, maxUnavailable: 1 } }
            : { type: "RollingUpdate", rollingUpdate: { maxSurge: 2, maxUnavailable: 0 } },
          selector: { matchLabels: { app: "analytics" } },
          template: { metadata: { labels: { app: "analytics" } } },
        },
        status: {
          replicas: fixed ? 2 : 4,
          readyReplicas: 2,
          updatedReplicas: fixed ? 2 : 0,
          unavailableReplicas: fixed ? 0 : 2,
        },
      },
    ],
    replicaSets: fixed
      ? [
          {
            metadata: {
              name: "analytics-3b8f1-v2rs",
              namespace: "default",
              labels: { app: "analytics", track: "v2" },
            },
            spec: {
              replicas: 2,
              selector: { matchLabels: { app: "analytics" } },
              template: { metadata: { labels: { app: "analytics", track: "v2" } } },
            },
            status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 },
          },
        ]
      : [
          {
            metadata: {
              name: "analytics-2a1c0-v1rs",
              namespace: "default",
              labels: { app: "analytics", track: "v1" },
            },
            spec: {
              replicas: 2,
              selector: { matchLabels: { app: "analytics" } },
              template: { metadata: { labels: { app: "analytics", track: "v1" } } },
            },
            status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 },
          },
          {
            metadata: {
              name: "analytics-3b8f1-v2rs",
              namespace: "default",
              labels: { app: "analytics", track: "v2" },
            },
            spec: {
              replicas: 2,
              selector: { matchLabels: { app: "analytics" } },
              template: { metadata: { labels: { app: "analytics", track: "v2" } } },
            },
            status: { replicas: 0, readyReplicas: 0, availableReplicas: 0 },
          },
        ],
    endpointSlices: [
      {
        metadata: {
          name: "analytics-svc-scripted",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "analytics-svc" },
        },
        addressType: "IPv4",
        endpoints,
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ],
    namespaces: [{ metadata: { name: "default" } }],
    nodes: [{ metadata: { name: "node-1" } }],
    events: fixed
      ? []
      : [
          {
            metadata: { name: "analytics-new-a-sched", namespace: "default" },
            involvedObject: { kind: "Pod", name: "analytics-new-a", namespace: "default" },
            type: "Warning",
            reason: "FailedScheduling",
            message:
              "0/1 nodes are available: 1 Insufficient cpu. Deployment rollout is blocked: maxSurge=2 cannot fit, maxUnavailable=0 will not yield capacity.",
          },
        ],
  } as unknown as ClusterSnapshot;
}

function immutableSelectorSnapshot(fixed: boolean): ClusterSnapshot {
  const image = "klab/search:1.4.0";
  const labels = fixed ? { app: "search", tier: "api" } : { app: "search" };
  const podSpec = (name: string, podIP: string) => ({
    metadata: { name, namespace: "default", labels },
    spec: {
      nodeName: "node-1",
      containers: [{ name: "api", image, ports: [{ name: "http", containerPort: 8080 }] }],
    },
    status: {
      phase: "Running",
      podIP,
      conditions: [{ type: "Ready", status: "True" }],
      containerStatuses: [
        {
          name: "api",
          image,
          imageID: "scripted://search-1.4.0",
          ready: true,
          restartCount: 0,
          state: { running: { startedAt: new Date("2026-07-10T00:00:00Z") } },
        },
      ],
    },
  });
  const pods = [podSpec("search-a", "10.0.0.61"), podSpec("search-b", "10.0.0.62")];
  // Service selects {app: search, tier: api}; pods only match when tier: api is present.
  const matchingPods = fixed ? pods : [];
  const endpoints = matchingPods.map((pod) => ({
    addresses: [pod.status.podIP],
    conditions: { ready: true },
    targetRef: { name: pod.metadata.name },
  }));
  const service = {
    metadata: { name: "search-svc", namespace: "default" },
    spec: {
      clusterIP: "10.96.0.95",
      selector: { app: "search", tier: "api" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  };
  return {
    pods,
    services: [service],
    deployments: [
      {
        metadata: { name: "search", namespace: "default" },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: "search" } },
          template: { metadata: { labels } },
        },
        status: { replicas: 2, readyReplicas: 2, updatedReplicas: 2 },
      },
    ],
    replicaSets: [
      {
        metadata: { name: "search-6e2a1-rs", namespace: "default", labels: { app: "search" } },
        spec: {
          replicas: 2,
          selector: { matchLabels: { app: "search" } },
          template: { metadata: { labels } },
        },
        status: { replicas: 2, readyReplicas: 2, availableReplicas: 2 },
      },
    ],
    endpointSlices: [
      {
        metadata: {
          name: "search-svc-scripted",
          namespace: "default",
          labels: { "kubernetes.io/service-name": "search-svc" },
        },
        addressType: "IPv4",
        endpoints,
        ports: [{ name: "http", port: 8080, protocol: "TCP" }],
      },
    ],
    namespaces: [{ metadata: { name: "default" } }],
    nodes: [{ metadata: { name: "node-1" } }],
    events: fixed
      ? []
      : [
          {
            metadata: { name: "search-endpoints-empty", namespace: "default" },
            involvedObject: { kind: "Service", name: "search-svc", namespace: "default" },
            type: "Warning",
            reason: "FailedToUpdateEndpoint",
            message:
              "Service search-svc selector app=search,tier=api matches no pods; current pods only carry app=search",
          },
        ],
  } as unknown as ClusterSnapshot;
}

function scriptedRunningPod(name: string, podIP: string, release: string, terminating = false) {
  return {
    metadata: {
      name,
      namespace: "default",
      labels: { app: "edge-api", release },
      deletionTimestamp: terminating ? new Date("2026-07-10T00:00:05Z") : undefined,
    },
    spec: {
      nodeName: release === "old" ? "node-1" : "node-2",
      containers: [
        {
          name: "api",
          image: "registry.example/edge-api:2.4.0",
          ports: [{ name: "http", containerPort: 8080 }],
        },
      ],
    },
    status: {
      phase: "Running",
      podIP,
      conditions: [{ type: "Ready", status: "True" }],
      containerStatuses: [
        {
          name: "api",
          image: "registry.example/edge-api:2.4.0",
          imageID: "scripted://edge-api-2.4.0",
          ready: true,
          restartCount: 0,
          state: { running: { startedAt: new Date("2026-07-10T00:00:00Z") } },
        },
      ],
    },
  };
}

function scriptedReplicaSet(name: string, release: string, replicas: number) {
  return {
    metadata: { name, namespace: "default", labels: { app: "edge-api", release } },
    spec: {
      replicas,
      selector: { matchLabels: { app: "edge-api", release } },
      template: { metadata: { labels: { app: "edge-api", release } } },
    },
    status: { replicas, readyReplicas: replicas, availableReplicas: replicas },
  };
}

function objectAt(value: unknown, path: string): Record<string, unknown> | undefined {
  const result = path ? valueAt(value, path) : value;
  return typeof result === "object" && result !== null
    ? (result as Record<string, unknown>)
    : undefined;
}

function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function scriptedLog(pod: string, container: string, message: string): LogLine {
  return {
    namespace: "default",
    pod,
    container,
    message,
    timestampMs: Date.parse("2026-07-10T00:00:00Z"),
  };
}
