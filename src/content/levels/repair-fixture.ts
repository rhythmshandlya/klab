import type {
  FixtureEvent,
  FixtureNode,
  FixturePod,
  FixtureResource,
  FixtureService,
  FixtureWorkload,
  LevelFixture,
} from "@/lib/domain/types";
import { parseKubernetesManifests } from "@/lib/kube/manifest-parser";

/**
 * Builds a production repair level's cluster from the manifest the level already
 * ships, so the workload the learner investigates is the workload the incident brief
 * describes: right namespace, right name, right image, right replica count.
 *
 * Every static repair used to share one anonymous `manifest-assessment` Deployment in
 * `default`, which meant `kubectl get pods -n payments` answered with something that
 * had nothing to do with the story. Deriving the fixture from the authored manifest
 * makes the cluster correct by construction rather than by thirty hand-written copies,
 * and `overrides` covers the incidents whose symptom is visible in Pod state
 * (pending scheduling, restart loops, node placement) rather than in the manifest.
 */

export interface RepairClusterInput {
  /** The level's editable manifest, in its broken form. */
  manifest: string;
  /** The canonical repaired manifest, used for the fixture's healthy object view. */
  repairedManifest: string;
  /** Resource the constraint targets, for namespace and workload identity. */
  resource: { kind: string; name: string; namespace?: string };
  /** One-line observable the learner is meant to find. Never states the fix. */
  symptom: string;
  /** Event reason the broken cluster raises. Defaults to a generic warning. */
  eventReason?: string;
  overrides?: RepairClusterOverrides;
}

export interface RepairClusterOverrides {
  /** Namespace where incident Pods, events, and namespaced supporting objects appear. */
  namespace?: string;
  /** Supporting Kubernetes objects the incident depends on but the learner may not edit. */
  resources?: FixtureResource[];
  /** The repaired state deletes the target object after its blocking finalizer clears. */
  omitHealthyTargetResource?: boolean;
  /** Broken-state supporting objects or status overlays. Later identities replace `resources`. */
  brokenResources?: FixtureResource[];
  /** Healthy-state supporting objects or status overlays. Later identities replace `resources`. */
  healthyResources?: FixtureResource[];
  /** Supporting Services exposed through normal kubectl Service and EndpointSlice views. */
  services?: FixtureService[];
  /** Workloads owned by a non-workload editable target, such as a Kustomize overlay. */
  workloads?: FixtureWorkload[];
  /** Nodes, when placement or capacity is part of the incident. */
  nodes?: FixtureNode[];
  /** Node each broken-state replica landed on, by index. */
  brokenNodeNames?: string[];
  /** Node each healthy-state replica lands on, by index. */
  healthyNodeNames?: string[];
  /** Broken-state Pod phase, when the incident stops Pods from running. */
  brokenPhase?: FixturePod["phase"];
  /** Broken-state container waiting reason, e.g. `CrashLoopBackOff`. */
  brokenWaitingReason?: string;
  /** Reason recorded on the previous terminated container attempt. */
  brokenLastTerminationReason?: string;
  /** Broken-state restart count, when the incident is a restart loop. */
  brokenRestarts?: number;
  /** Extra events the broken cluster raises, beyond the symptom event. */
  brokenEvents?: FixtureEvent[];
  /** Extra broken-state log lines, beyond the symptom line. */
  brokenLogs?: string[];
  /** Explicit incident Pods for a non-workload resource such as a cluster or policy. */
  brokenPods?: FixturePod[];
  /** Explicit repaired Pods paired with `brokenPods`. */
  healthyPods?: FixturePod[];
  /** Incident Pods shown alongside the target workload's generated replicas. */
  additionalBrokenPods?: FixturePod[];
  /** Repaired Pods shown alongside the target workload's generated replicas. */
  additionalHealthyPods?: FixturePod[];
}

interface WorkloadShape {
  namespace: string;
  name: string;
  replicas: number;
  labels: Record<string, string>;
  priorityClassName?: string;
  container: { name: string; image: string; port?: { name: string; containerPort: number } };
}

/**
 * The Pod labels this level's own workload carries, so quick commands can target a
 * real Pod by selector instead of a hard-coded placeholder name.
 */
export function repairWorkloadSelector(
  input: Pick<RepairClusterInput, "manifest" | "resource">,
): Record<string, string> {
  return readWorkloadShape({ ...input, symptom: "" }).labels;
}

/** Resource that is actually present for the learner to inspect before the repair. */
export function repairObservedResource(input: Pick<RepairClusterInput, "manifest" | "resource">): {
  kind: string;
  name: string;
  namespace: string;
} {
  const resource = readVisibleResource(input.manifest, input.resource);
  return {
    kind: resource?.kind ?? input.resource.kind,
    name: resource?.metadata.name ?? input.resource.name,
    namespace: resource?.metadata.namespace ?? input.resource.namespace ?? "default",
  };
}

export function buildRepairFixture(input: RepairClusterInput): LevelFixture {
  const brokenShape = readWorkloadShape(input);
  const healthyShape = readWorkloadShape({
    manifest: input.repairedManifest,
    resource: input.resource,
    symptom: input.symptom,
  });
  const brokenResource = readVisibleResource(input.manifest, input.resource);
  const healthyResource = readVisibleResource(input.repairedManifest, input.resource);
  const brokenService = readVisibleService(input.manifest, input.resource);
  const healthyService = readVisibleService(input.repairedManifest, input.resource);
  const overrides = input.overrides ?? {};
  const fixtureNamespace = overrides.namespace ?? brokenShape.namespace;
  const nodes = overrides.nodes ?? [{ name: "node-1" }, { name: "node-2" }];
  const nodeNames = nodes.map((node) => node.name);

  return {
    broken: {
      namespace: fixtureNamespace,
      resources: mergeResources(
        brokenResource ? [brokenResource] : [],
        overrides.resources,
        overrides.brokenResources,
      ),
      services: mergeServices(brokenService, overrides.services, fixtureNamespace),
      nodes,
      workloads:
        input.resource.kind === "Deployment"
          ? [
              {
                name: brokenShape.name,
                replicas: brokenShape.replicas,
                selector: brokenShape.labels,
              },
            ]
          : (overrides.workloads ?? []),
      pods: [
        ...(overrides.brokenPods ??
          replicaPods(brokenShape, {
            nodeNames: overrides.brokenNodeNames ?? nodeNames,
            phase: overrides.brokenPhase,
            // A Pod that never scheduled has no address and cannot be Ready.
            ready:
              overrides.brokenPhase === undefined && overrides.brokenWaitingReason === undefined,
            waitingReason: overrides.brokenWaitingReason,
            lastTerminationReason: overrides.brokenLastTerminationReason,
            restartCount: overrides.brokenRestarts,
            logs: [input.symptom, ...(overrides.brokenLogs ?? [])],
          })),
        ...(overrides.additionalBrokenPods ?? []),
      ],
      events: [
        {
          reason: input.eventReason ?? "IncidentDetected",
          type: "Warning",
          message: input.symptom,
          involvedObject: {
            kind: brokenResource?.kind ?? brokenShape.kindForEvents,
            name: brokenResource?.metadata.name ?? brokenShape.name,
          },
        },
        ...(overrides.brokenEvents ?? []),
      ],
    },
    healthy: {
      namespace: fixtureNamespace,
      resources: mergeResources(
        healthyResource && !overrides.omitHealthyTargetResource ? [healthyResource] : [],
        overrides.resources,
        overrides.healthyResources,
      ),
      services: mergeServices(healthyService, overrides.services, fixtureNamespace),
      nodes,
      workloads:
        input.resource.kind === "Deployment"
          ? [
              {
                name: healthyShape.name,
                replicas: healthyShape.replicas,
                selector: healthyShape.labels,
              },
            ]
          : (overrides.workloads ?? []),
      pods: [
        ...(overrides.healthyPods ??
          replicaPods(healthyShape, {
            nodeNames: overrides.healthyNodeNames ?? nodeNames,
            ready: true,
            logs: [`${healthyShape.container.name} serving normally`],
          })),
        ...(overrides.additionalHealthyPods ?? []),
      ],
      events: [
        {
          reason: "IncidentResolved",
          type: "Normal",
          message: `${healthyShape.name} meets its production requirements`,
          involvedObject: { kind: healthyShape.kindForEvents, name: healthyShape.name },
        },
      ],
    },
  };
}

/* -------------------------------------------------------------------------- */

type Shape = WorkloadShape & { kindForEvents: string };

function readWorkloadShape(
  input: Pick<RepairClusterInput, "manifest" | "resource" | "symptom">,
): Shape {
  const namespace = input.resource.namespace ?? "default";
  const parsed = parseKubernetesManifests(input.manifest);
  const target = parsed.ok
    ? parsed.value.find(
        (manifest) =>
          manifest.kind === input.resource.kind && manifest.name === input.resource.name,
      )
    : undefined;

  const raw = (target?.raw ?? {}) as Record<string, unknown>;
  const spec = record(raw.spec);
  const metadata = record(raw.metadata);
  const templateObject = record(spec?.template);
  const podSpec = input.resource.kind === "Pod" ? spec : record(templateObject?.spec);
  const containers = Array.isArray(podSpec?.containers) ? podSpec.containers : [];
  const container = record(containers[0]);
  const ports = Array.isArray(container?.ports) ? container.ports : [];
  const port = record(ports[0]);
  const labels = record(record(templateObject?.metadata)?.labels) ??
    (input.resource.kind === "Pod" ? record(metadata?.labels) : undefined) ??
    record(record(spec?.selector)?.matchLabels) ?? { app: input.resource.name };
  const ownsPods = ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Pod"].includes(
    input.resource.kind,
  );
  const replicas =
    typeof spec?.replicas === "number" && spec.replicas >= 0
      ? spec.replicas
      : input.resource.kind === "DaemonSet"
        ? 2
        : ownsPods
          ? 1
          : 0;

  return {
    namespace,
    name: input.resource.name,
    kindForEvents: input.resource.kind,
    // Only resources that directly own Pods synthesize them. Cluster policy, storage,
    // RBAC, and Service objects need explicit incident Pods in `overrides` rather than
    // an invented app that shares the target object's name.
    replicas,
    labels: Object.fromEntries(
      Object.entries(labels).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    ...(typeof podSpec?.priorityClassName === "string"
      ? { priorityClassName: podSpec.priorityClassName }
      : {}),
    container: {
      name: typeof container?.name === "string" ? container.name : "app",
      image: typeof container?.image === "string" ? container.image : "registry.example/app:1.0.0",
      port:
        typeof port?.containerPort === "number"
          ? {
              name: typeof port.name === "string" ? port.name : "http",
              containerPort: port.containerPort,
            }
          : { name: "http", containerPort: 8080 },
    },
  };
}

function readVisibleResource(
  manifest: string,
  target: RepairClusterInput["resource"],
): FixtureResource | undefined {
  const parsed = parseKubernetesManifests(manifest);
  if (!parsed.ok) return undefined;
  const resource =
    parsed.value.find(
      (candidate) => candidate.kind === target.kind && candidate.name === target.name,
    ) ?? parsed.value[0];
  return resource?.raw as FixtureResource | undefined;
}

/** Render an authored Service through the core Service/EndpointSlice surfaces too. */
function readVisibleService(
  manifest: string,
  target: RepairClusterInput["resource"],
): FixtureService | undefined {
  const resource = readVisibleResource(manifest, target);
  if (resource?.kind !== "Service") return undefined;
  const spec = record(resource.spec);
  const selector = record(spec?.selector) ?? {};
  const annotations = record(resource.metadata.annotations) ?? {};
  const ports = Array.isArray(spec?.ports) ? spec.ports : [];
  const type = ["ClusterIP", "NodePort", "LoadBalancer"].includes(String(spec?.type))
    ? (spec?.type as FixtureService["type"])
    : undefined;
  const externalTrafficPolicy = ["Cluster", "Local"].includes(String(spec?.externalTrafficPolicy))
    ? (spec?.externalTrafficPolicy as FixtureService["externalTrafficPolicy"])
    : undefined;

  return {
    name: resource.metadata.name,
    ...(resource.metadata.namespace ? { namespace: resource.metadata.namespace } : {}),
    clusterIP: typeof spec?.clusterIP === "string" ? spec.clusterIP : "10.96.0.10",
    selector: Object.fromEntries(
      Object.entries(selector).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    ports: ports.flatMap((portValue, index) => {
      const port = record(portValue);
      if (typeof port?.port !== "number") return [];
      return [
        {
          name: typeof port.name === "string" ? port.name : `port-${index + 1}`,
          port: port.port,
          targetPort:
            typeof port.targetPort === "number" || typeof port.targetPort === "string"
              ? port.targetPort
              : port.port,
        },
      ];
    }),
    ...(Object.keys(annotations).length > 0
      ? {
          annotations: Object.fromEntries(
            Object.entries(annotations).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
        }
      : {}),
    ...(type ? { type } : {}),
    ...(externalTrafficPolicy ? { externalTrafficPolicy } : {}),
    ...(typeof spec?.publishNotReadyAddresses === "boolean"
      ? { publishNotReadyAddresses: spec.publishNotReadyAddresses }
      : {}),
  };
}

function mergeServices(
  target: FixtureService | undefined,
  supporting: FixtureService[] | undefined,
  fixtureNamespace: string,
): FixtureService[] {
  const services = [...(target ? [target] : []), ...(supporting ?? [])];
  return services.filter(
    (service, index) =>
      services.findIndex(
        (candidate) =>
          candidate.name === service.name &&
          (candidate.namespace ?? fixtureNamespace) === (service.namespace ?? fixtureNamespace),
      ) === index,
  );
}

function mergeResources(...groups: (readonly FixtureResource[] | undefined)[]): FixtureResource[] {
  const byIdentity = new Map<string, FixtureResource>();
  for (const resource of groups.flatMap((group) => group ?? [])) {
    const identity = [
      resource.kind.toLowerCase(),
      resource.metadata.namespace ?? "",
      resource.metadata.name,
    ].join("/");
    const existing = byIdentity.get(identity);
    byIdentity.set(
      identity,
      existing
        ? {
            ...existing,
            ...resource,
            metadata: { ...existing.metadata, ...resource.metadata },
          }
        : resource,
    );
  }
  return [...byIdentity.values()];
}

function replicaPods(
  shape: Shape,
  options: {
    nodeNames: string[];
    phase?: FixturePod["phase"];
    ready?: boolean;
    waitingReason?: string;
    lastTerminationReason?: string;
    restartCount?: number;
    logs: string[];
  },
): FixturePod[] {
  const scheduled = options.phase !== "Pending";
  return Array.from({ length: shape.replicas }, (_unused, index) => ({
    name: `${shape.name}-${podSuffix(index)}`,
    labels: shape.labels,
    priorityClassName: shape.priorityClassName,
    nodeName: scheduled
      ? (options.nodeNames[index % Math.max(1, options.nodeNames.length)] ?? "node-1")
      : undefined,
    podIP: scheduled ? `10.0.${index}.${10 + index}` : undefined,
    phase: options.phase,
    ready: options.ready !== false && scheduled && options.waitingReason === undefined,
    containers: [
      {
        ...shape.container,
        ready: options.ready !== false && scheduled && options.waitingReason === undefined,
        restartCount: options.restartCount,
        waitingReason: options.waitingReason,
        lastTerminationReason: options.lastTerminationReason,
      },
    ],
    logs: scheduled ? options.logs.map((message) => ({ message })) : [],
  }));
}

/** Deterministic, kubectl-shaped Pod suffixes so output is stable across renders. */
function podSuffix(index: number): string {
  return (
    ["7d4f9", "6c2b8", "5a1e7", "4b3d6", "3e8c5", "2f7a4", "1d6b3", "9c5a2"][index] ?? `p${index}`
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
