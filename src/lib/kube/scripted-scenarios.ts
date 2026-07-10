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

const CAPABILITIES: Readonly<Record<string, ReadonlySet<ProblemCapability>>> = {
  "private-registry-pull": PRIVATE_REGISTRY_CAPABILITIES,
  "graceful-shutdown-502": GRACEFUL_SHUTDOWN_CAPABILITIES,
};

export function scriptedScenarioCapabilities(scenarioId: string): ReadonlySet<ProblemCapability> {
  return CAPABILITIES[scenarioId] ?? new Set();
}

export function createScriptedScenarioRuntime(
  scenarioId: string,
): ScriptedScenarioRuntime | undefined {
  if (scenarioId === "private-registry-pull") return new PrivateRegistryScenario();
  if (scenarioId === "graceful-shutdown-502") return new GracefulShutdownScenario();
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
