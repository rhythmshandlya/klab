import type {
  Cluster,
  ClusterApplyResource,
  ClusterInformerEventType,
  ClusterInformerResource,
  CoreV1Event,
  ImageConstructor,
  Informer,
  KubernetesObject,
  V1Deployment,
  V1EndpointSlice,
  V1Namespace,
  V1Node,
  V1Pod,
  V1ReplicaSet,
  V1Service,
} from "@ngrok/webernetes";

import { err, ok, type Result } from "@/lib/utils/result";

import { logSink, type LogLine } from "./images/log-sink";
import { parseManifests, type ParsedManifest } from "./manifest-parser";

/**
 * KubeSimulator — the single facade the UI uses to talk to the simulated cluster.
 *
 * Wraps @ngrok/webernetes (a real, browser-based Kubernetes control plane: scheduler,
 * kubelet with readiness/liveness probers, and deployment/replicaset/endpointslice
 * controllers). Because Webernetes is browser-only ESM, this module imports it (and
 * the fake images) DYNAMICALLY inside `boot()` so nothing runs during SSR. Only
 * type-only imports appear at module top level.
 *
 * Live object state is maintained via informers (list-then-watch) into an in-memory
 * cache; `getSnapshot()` reads it synchronously and `subscribe()` pushes updates.
 */

export type SimulatorStatus = "idle" | "booting" | "ready" | "error";

export interface ClusterSnapshot {
  pods: V1Pod[];
  services: V1Service[];
  deployments: V1Deployment[];
  replicaSets: V1ReplicaSet[];
  endpointSlices: V1EndpointSlice[];
  namespaces: V1Namespace[];
  nodes: V1Node[];
  events: CoreV1Event[];
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  body: string;
  reason?: string;
}

export interface AppliedResourceRef {
  kind: string;
  name: string;
  namespace: string;
}

const EMPTY_SNAPSHOT: ClusterSnapshot = {
  pods: [],
  services: [],
  deployments: [],
  replicaSets: [],
  endpointSlices: [],
  namespaces: [],
  nodes: [],
  events: [],
};

const INFORMER_RESOURCES: ClusterInformerResource[] = [
  "pods",
  "services",
  "deployments",
  "replicasets",
  "endpointslices",
  "namespaces",
  "nodes",
  "events",
];

type SnapshotListener = (snapshot: ClusterSnapshot) => void;

export interface KubeSimulatorOptions {
  /** Image constructors to register. Defaults to all klab images. */
  images?: readonly ImageConstructor[];
}

export class KubeSimulator {
  private cluster: Cluster | null = null;
  private informers: Informer<KubernetesObject>[] = [];
  private readonly caches = new Map<ClusterInformerResource, Map<string, KubernetesObject>>();
  private readonly listeners = new Set<SnapshotListener>();
  private snapshot: ClusterSnapshot = EMPTY_SNAPSHOT;
  private notifyScheduled = false;
  private statusValue: SimulatorStatus = "idle";
  private readonly options: KubeSimulatorOptions;
  // All lifecycle transitions (boot/close/reset) run through this chain so they
  // execute strictly one-after-another. React StrictMode double-invokes effects in
  // dev (mount → unmount → mount), firing boot → close → boot on the SAME instance;
  // serializing makes that sequence resolve deterministically to a booted cluster
  // instead of racing (which previously surfaced "Simulator is already booting").
  private lifecycleChain: Promise<unknown> = Promise.resolve();

  constructor(options: KubeSimulatorOptions = {}) {
    this.options = options;
    for (const resource of INFORMER_RESOURCES) {
      this.caches.set(resource, new Map());
    }
  }

  get status(): SimulatorStatus {
    return this.statusValue;
  }

  /**
   * Run a lifecycle op serialized after any in-flight one. Failures don't poison the
   * chain — the next op still runs (it inspects live state, e.g. doBoot() is a no-op
   * when already ready).
   */
  private serializeLifecycle<T>(op: () => Promise<T>): Promise<T> {
    const run = this.lifecycleChain.then(op, op);
    this.lifecycleChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Boot the control plane, register images, and start informers. Idempotent: a call
   *  while already booted resolves ok without rebooting. Safe to interleave with close(). */
  async boot(): Promise<Result<void, string>> {
    return this.serializeLifecycle(() => this.doBoot());
  }

  private async doBoot(): Promise<Result<void, string>> {
    // Already up (e.g. a duplicate boot with no intervening close) — nothing to do.
    if (this.statusValue === "ready" && this.cluster) return ok(undefined);
    this.statusValue = "booting";
    try {
      const [{ Cluster }, { KLAB_IMAGES }] = await Promise.all([
        import("@ngrok/webernetes"),
        import("./images"),
      ]);
      const cluster = new Cluster();
      const images = this.options.images ?? KLAB_IMAGES;
      for (const image of images) cluster.registerImage(image);
      await cluster.init();
      this.cluster = cluster;
      this.startInformers(cluster);
      this.statusValue = "ready";
      this.rebuildAndNotify();
      return ok(undefined);
    } catch (error) {
      this.statusValue = "error";
      return err(describeError(error, "Failed to boot the cluster simulator"));
    }
  }

  private startInformers(cluster: Cluster): void {
    for (const resource of INFORMER_RESOURCES) {
      const informer = cluster.informer(resource, (type, object) => {
        this.applyInformerEvent(resource, type, object);
      }) as Informer<KubernetesObject>;
      this.informers.push(informer);
    }
  }

  private applyInformerEvent(
    resource: ClusterInformerResource,
    type: ClusterInformerEventType,
    object: KubernetesObject,
  ): void {
    const cache = this.caches.get(resource);
    if (!cache) return;
    const key = cacheKey(object);
    if (type === "delete") cache.delete(key);
    else cache.set(key, object);
    this.scheduleNotify();
  }

  private scheduleNotify(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      this.rebuildAndNotify();
    });
  }

  private rebuildAndNotify(): void {
    this.snapshot = {
      pods: this.read<V1Pod>("pods"),
      services: this.read<V1Service>("services"),
      deployments: this.read<V1Deployment>("deployments"),
      replicaSets: this.read<V1ReplicaSet>("replicasets"),
      endpointSlices: this.read<V1EndpointSlice>("endpointslices"),
      namespaces: this.read<V1Namespace>("namespaces"),
      nodes: this.read<V1Node>("nodes"),
      events: this.read<CoreV1Event>("events"),
    };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private read<T>(resource: ClusterInformerResource): T[] {
    const cache = this.caches.get(resource);
    // Cache values are the informer's typed objects; the resource key fixes T.
    return cache ? (Array.from(cache.values()) as unknown as T[]) : [];
  }

  getSnapshot(): ClusterSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Apply YAML (multi-doc). Parse errors and Webernetes validation errors both surface as Result errors. */
  async applyYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    const parsed = parseManifests(yamlText);
    if (!parsed.ok) return err(parsed.error.message);
    return this.applyManifests(parsed.value);
  }

  async applyManifests(manifests: ParsedManifest[]): Promise<Result<AppliedResourceRef[], string>> {
    const cluster = this.requireCluster();
    if (!cluster.ok) return cluster;
    if (manifests.length === 0) return ok([]);
    try {
      // Pods are immutable in Kubernetes — a plain apply of a changed Pod is a no-op on
      // the running pod. To let learners re-apply an edited Pod (e.g. fixing a probe),
      // delete any existing Pod of the same name first and wait for it to be removed,
      // then create the replacement. Non-Pod kinds apply normally.
      const existingPods = manifests.filter(
        (m) => m.kind === "Pod" && this.podExists(m.name, m.namespace),
      );
      for (const pod of existingPods) {
        await cluster.value.api.corev1
          .deleteNamespacedPod({ name: pod.name, namespace: pod.namespace })
          .catch(() => undefined);
      }
      if (existingPods.length > 0) await this.waitForPodsGone(existingPods);

      // The parser validated structure; Webernetes validates the deep spec on apply.
      // The raw objects are Kubernetes manifests; cast to the apply union at this boundary.
      const resources = manifests.map((m) => m.raw) as unknown as ClusterApplyResource[];
      await cluster.value.apply(resources);
      return ok(manifests.map((m) => ({ kind: m.kind, name: m.name, namespace: m.namespace })));
    } catch (error) {
      return err(describeError(error, "Failed to apply manifest"));
    }
  }

  private podExists(name: string, namespace: string): boolean {
    return this.snapshot.pods.some(
      (p) => p.metadata?.name === name && (p.metadata?.namespace ?? "default") === namespace,
    );
  }

  private async waitForPodsGone(
    refs: { name: string; namespace: string }[],
    timeoutMs = 8000,
  ): Promise<void> {
    const gone = () => refs.every((r) => !this.podExists(r.name, r.namespace));
    const start = Date.now();
    while (!gone() && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /** Delete the resources described by a YAML document, by name. */
  async deleteYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    const parsed = parseManifests(yamlText);
    if (!parsed.ok) return err(parsed.error.message);
    const cluster = this.requireCluster();
    if (!cluster.ok) return cluster;
    const api = cluster.value.api;
    const deleted: AppliedResourceRef[] = [];
    try {
      for (const m of parsed.value) {
        const ref = { name: m.name, namespace: m.namespace };
        switch (m.kind) {
          case "Deployment":
            await api.appsv1.deleteNamespacedDeployment(ref);
            break;
          case "ReplicaSet":
            await api.appsv1.deleteNamespacedReplicaSet(ref);
            break;
          case "Pod":
            await api.corev1.deleteNamespacedPod(ref);
            break;
          case "Service":
            await api.corev1.deleteNamespacedService(ref);
            break;
          case "Namespace":
            await api.corev1.deleteNamespace({ name: m.name });
            break;
          case "Node":
            await api.corev1.deleteNode({ name: m.name });
            break;
        }
        deleted.push({ kind: m.kind, name: m.name, namespace: m.namespace });
      }
      return ok(deleted);
    } catch (error) {
      return err(describeError(error, "Failed to delete resource"));
    }
  }

  /** Probe a URL through the cluster network (powers curl + the network-probe panel). */
  async probe(url: string): Promise<ProbeResult> {
    const cluster = this.requireCluster();
    if (!cluster.ok) return { ok: false, status: 0, body: "", reason: cluster.error };
    try {
      const response = await cluster.value.fetch(url);
      return {
        ok: response.status >= 200 && response.status < 400,
        status: response.status,
        body: response.body ?? "",
      };
    } catch (error) {
      return { ok: false, status: 0, body: "", reason: describeError(error, "Request failed") };
    }
  }

  /** Exec a command inside a container (returns combined result, never throws for command errors). */
  async exec(
    namespace: string,
    pod: string,
    container: string | undefined,
    argv: string[],
  ): Promise<Result<{ exitCode: number; stdout: string; stderr: string }, string>> {
    const cluster = this.requireCluster();
    if (!cluster.ok) return cluster;
    try {
      const result = await cluster.value.exec(namespace, pod, container, argv);
      return ok(result);
    } catch (error) {
      return err(describeError(error, "exec failed"));
    }
  }

  getLogs(namespace: string, pod: string, container?: string): LogLine[] {
    return logSink.forPod(namespace, pod, container);
  }

  /** Tear down and recreate a fresh cluster. */
  async reset(): Promise<Result<void, string>> {
    return this.serializeLifecycle(async () => {
      await this.doTeardown();
      return this.doBoot();
    });
  }

  async close(): Promise<void> {
    await this.serializeLifecycle(async () => {
      await this.doTeardown();
      this.statusValue = "idle";
    });
  }

  private async doTeardown(): Promise<void> {
    await Promise.allSettled(this.informers.map((informer) => informer.stop()));
    this.informers = [];
    if (this.cluster) {
      await this.cluster.close().catch(() => undefined);
      this.cluster = null;
    }
    for (const cache of this.caches.values()) cache.clear();
    logSink.clear();
    this.snapshot = EMPTY_SNAPSHOT;
  }

  private requireCluster(): Result<Cluster, string> {
    if (!this.cluster || this.statusValue !== "ready") {
      return err("Cluster is not ready. Boot the simulator first.");
    }
    return ok(this.cluster);
  }
}

function cacheKey(object: KubernetesObject): string {
  const namespace = object.metadata?.namespace ?? "";
  const name = object.metadata?.name ?? object.metadata?.uid ?? "";
  return `${namespace}/${name}`;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error) return `${fallback}: ${error.message}`;
  if (typeof error === "string") return `${fallback}: ${error}`;
  return fallback;
}
