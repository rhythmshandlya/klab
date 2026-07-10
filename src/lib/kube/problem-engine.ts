import type { ProblemEngineSpec, ProblemLevel } from "@/lib/domain/types";
import { err, ok, type Result } from "@/lib/utils/result";

import { runCommandLine, type CommandResult } from "./command-runner";
import type { LogLine } from "./images/log-sink";
import { parseManifests } from "./manifest-parser";
import { applyProblemBoot } from "./problem-boot";
import {
  KubeSimulator,
  type AppliedResourceRef,
  type ClusterSnapshot,
  type ProbeResult,
} from "./simulator";
import { runLevelValidation, type ValidationReport } from "./validators";

export type ProblemSnapshotListener = (snapshot: ClusterSnapshot) => void;

export interface ProblemEngine {
  readonly kind: ProblemEngineSpec["kind"];
  boot(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>>;
  reset(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>>;
  close(): Promise<void>;
  subscribe(listener: ProblemSnapshotListener): () => void;
  getSnapshot(): ClusterSnapshot;
  applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>>;
  probe(url: string): Promise<ProbeResult>;
  validate(level: ProblemLevel, files: Readonly<Record<string, string>>): Promise<ValidationReport>;
  runCommand(
    line: string,
    namespace: string,
    files: Record<string, string>,
  ): Promise<CommandResult>;
}

function joinDocs(documents: readonly string[]): string {
  return documents.filter((document) => document.trim() !== "").join("\n---\n");
}

export class WebernetesProblemEngine implements ProblemEngine {
  readonly kind = "webernetes" as const;
  private readonly simulator = new KubeSimulator();

  async boot(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    const booted = await this.simulator.boot();
    if (!booted.ok) return booted;
    return applyProblemBoot(this.simulator, level);
  }

  async reset(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    const reset = await this.simulator.reset();
    if (!reset.ok) return reset;
    return applyProblemBoot(this.simulator, level);
  }

  close(): Promise<void> {
    return this.simulator.close();
  }

  subscribe(listener: ProblemSnapshotListener): () => void {
    return this.simulator.subscribe(listener);
  }

  getSnapshot(): ClusterSnapshot {
    return this.simulator.getSnapshot();
  }

  applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>> {
    return this.simulator.applyYaml(joinDocs(Object.values(files)));
  }

  probe(url: string): Promise<ProbeResult> {
    return this.simulator.probe(url);
  }

  validate(
    level: ProblemLevel,
    files: Readonly<Record<string, string>>,
  ): Promise<ValidationReport> {
    return runLevelValidation(level, files, { simulator: this.simulator });
  }

  runCommand(
    line: string,
    namespace: string,
    files: Record<string, string>,
  ): Promise<CommandResult> {
    return runCommandLine(line, { simulator: this.simulator, namespace, files });
  }
}

type ScriptedState = "broken" | "fixed";

export class ScriptedIncidentEngine implements ProblemEngine {
  readonly kind = "scripted" as const;
  private state: ScriptedState = "broken";
  private readonly listeners = new Set<ProblemSnapshotListener>();

  constructor(private readonly scenarioId: string) {}

  async boot(_level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    if (this.scenarioId !== "private-registry-pull") {
      return err(`Unknown scripted scenario: ${this.scenarioId}`);
    }
    this.state = "broken";
    this.emit();
    return ok([
      { kind: "Deployment", name: "private-api", namespace: "default" },
      { kind: "Service", name: "private-api-svc", namespace: "default" },
    ]);
  }

  reset(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    return this.boot(level);
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }

  subscribe(listener: ProblemSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ClusterSnapshot {
    return privateRegistrySnapshot(this.state);
  }

  async applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>> {
    return this.applyYaml(joinDocs(Object.values(files)));
  }

  async applyYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    const parsed = parseManifests(yamlText);
    if (!parsed.ok) return err(parsed.error.message);
    const deployment = parsed.value.find(
      (manifest) => manifest.kind === "Deployment" && manifest.name === "private-api",
    );
    if (!deployment) return err("The private-api Deployment is missing.");
    const template = objectAt(deployment.raw, "spec.template.spec");
    const pullSecrets = Array.isArray(template?.imagePullSecrets) ? template.imagePullSecrets : [];
    this.state = pullSecrets.some((entry) => objectAt(entry, "")?.name === "registry-credentials")
      ? "fixed"
      : "broken";
    this.emit();
    return ok([{ kind: "Deployment", name: "private-api", namespace: "default" }]);
  }

  async deleteYaml(_yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    return err("Deleting scripted scenario resources is not supported.");
  }

  async probe(url: string): Promise<ProbeResult> {
    const host = safeHostname(url);
    if (host !== "private-api-svc" && host !== "private-api-svc.default.svc.cluster.local") {
      return { ok: false, status: 0, body: "", reason: `Service ${host || url} not found` };
    }
    return this.state === "fixed"
      ? { ok: true, status: 200, body: "private api ready\n" }
      : { ok: false, status: 503, body: "no ready endpoints\n", reason: "ImagePullBackOff" };
  }

  validate(
    level: ProblemLevel,
    files: Readonly<Record<string, string>>,
  ): Promise<ValidationReport> {
    return runLevelValidation(level, files, { simulator: this });
  }

  runCommand(
    line: string,
    namespace: string,
    files: Record<string, string>,
  ): Promise<CommandResult> {
    return runCommandLine(line, { simulator: this, namespace, files });
  }

  getLogs(namespace: string, pod: string, _container?: string): LogLine[] {
    if (namespace !== "default" || pod !== "private-api-6f4d9") return [];
    return this.state === "fixed" ? [scriptedLog(pod, "server listening on :8080")] : [];
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function createProblemEngine(spec: ProblemEngineSpec): ProblemEngine {
  return spec.kind === "webernetes"
    ? new WebernetesProblemEngine()
    : new ScriptedIncidentEngine(spec.scenarioId);
}

function privateRegistrySnapshot(state: ScriptedState): ClusterSnapshot {
  const fixed = state === "fixed";
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
  const endpointSlice = {
    metadata: {
      name: "private-api-svc-scripted",
      namespace: "default",
      labels: { "kubernetes.io/service-name": "private-api-svc" },
    },
    addressType: "IPv4",
    endpoints: fixed
      ? [{ addresses: ["10.0.0.21"], conditions: { ready: true }, targetRef: { name: podName } }]
      : [],
    ports: [{ name: "http", port: 8080, protocol: "TCP" }],
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
    endpointSlices: [endpointSlice],
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

function objectAt(value: unknown, path: string): Record<string, unknown> | undefined {
  const result = path
    ? path.split(".").reduce<unknown>((current, segment) => {
        if (typeof current !== "object" || current === null) return undefined;
        return (current as Record<string, unknown>)[segment];
      }, value)
    : value;
  return typeof result === "object" && result !== null
    ? (result as Record<string, unknown>)
    : undefined;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function scriptedLog(pod: string, message: string): LogLine {
  return {
    namespace: "default",
    pod,
    container: "api",
    message,
    timestampMs: Date.parse("2026-07-10T00:00:00Z"),
  };
}
