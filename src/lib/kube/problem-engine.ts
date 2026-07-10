import type { ProblemCapability, ProblemEngineSpec, ProblemLevel } from "@/lib/domain/types";
import { err, type Result } from "@/lib/utils/result";

import { runCommandLine, type CommandResult } from "./command-runner";
import type { LogLine } from "./images/log-sink";
import { parseManifests } from "./manifest-parser";
import { applyProblemBoot } from "./problem-boot";
import { capabilitiesForEngine, unsupportedProblemCapabilities } from "./problem-capabilities";
import {
  createScriptedScenarioRuntime,
  emptyScriptedSnapshot,
  type ScriptedScenarioRuntime,
} from "./scripted-scenarios";
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
  readonly capabilities: ReadonlySet<ProblemCapability>;
  boot(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>>;
  reset(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>>;
  close(): Promise<void>;
  subscribe(listener: ProblemSnapshotListener): () => void;
  getSnapshot(): ClusterSnapshot;
  applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>>;
  probe(url: string): Promise<ProbeResult>;
  getLogs(namespace: string, pod: string, container?: string): LogLine[];
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
  readonly capabilities = capabilitiesForEngine({ kind: "webernetes" });
  private readonly simulator = new KubeSimulator();

  async boot(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    const unsupported = unsupportedProblemCapabilities(level);
    if (unsupported.length > 0) {
      return err(`Webernetes does not support: ${unsupported.join(", ")}`);
    }
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

  getLogs(namespace: string, pod: string, container?: string): LogLine[] {
    return this.simulator.getLogs(namespace, pod, container);
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

export class ScriptedIncidentEngine implements ProblemEngine {
  readonly kind = "scripted" as const;
  readonly capabilities: ReadonlySet<ProblemCapability>;
  private readonly listeners = new Set<ProblemSnapshotListener>();
  private readonly runtime: ScriptedScenarioRuntime | undefined;

  constructor(private readonly scenarioId: string) {
    this.capabilities = capabilitiesForEngine({ kind: "scripted", scenarioId });
    this.runtime = createScriptedScenarioRuntime(scenarioId);
  }

  async boot(level: ProblemLevel): Promise<Result<AppliedResourceRef[], string>> {
    if (!this.runtime) return err(`Unknown scripted scenario: ${this.scenarioId}`);
    const unsupported = unsupportedProblemCapabilities(level);
    if (unsupported.length > 0) {
      return err(`Scripted scenario does not support: ${unsupported.join(", ")}`);
    }
    const booted = this.runtime.boot();
    this.emit();
    return booted;
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
    return this.runtime?.snapshot() ?? emptyScriptedSnapshot();
  }

  async applyFiles(
    files: Readonly<Record<string, string>>,
  ): Promise<Result<AppliedResourceRef[], string>> {
    return this.applyYaml(joinDocs(Object.values(files)));
  }

  async applyYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    if (!this.runtime) return err(`Unknown scripted scenario: ${this.scenarioId}`);
    const parsed = parseManifests(yamlText);
    if (!parsed.ok) return err(parsed.error.message);
    const applied = this.runtime.apply(parsed.value);
    if (applied.ok) this.emit();
    return applied;
  }

  async deleteYaml(_yamlText: string): Promise<Result<AppliedResourceRef[], string>> {
    return err("Deleting scripted scenario resources is not supported.");
  }

  async probe(url: string): Promise<ProbeResult> {
    return (
      this.runtime?.probe(url) ?? {
        ok: false,
        status: 0,
        body: "",
        reason: `Unknown scripted scenario: ${this.scenarioId}`,
      }
    );
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

  getLogs(namespace: string, pod: string, container?: string): LogLine[] {
    return this.runtime?.logs(namespace, pod, container) ?? [];
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
