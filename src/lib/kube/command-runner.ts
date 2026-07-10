import type { CoreV1Event, V1Container, V1Pod, V1Service } from "@ngrok/webernetes";

import { stringifyManifest } from "./manifest-parser";
import { createProbeSignal, type InvestigationSignal } from "./evidence";
import {
  deploymentReadyReplicas,
  eventAge,
  formatTable,
  humanizeAge,
  podPhase,
  podReadyCounts,
  podRestarts,
  servicePortsSummary,
} from "./kubectl/format";
import type { AppliedResourceRef, ClusterSnapshot, ProbeResult } from "./simulator";
import type { LogLine } from "./images/log-sink";
import type { Result } from "@/lib/utils/result";

/**
 * A small, deliberately limited kubectl-like command runner. It does not aim to be a
 * real shell — it must *feel* real. Commands parse into a discriminated union, then
 * execute against the simulator's live snapshot. Unknown/unsupported input returns
 * helpful, educational output (never throws), per the product UX rules.
 */

export interface CommandRuntime {
  getSnapshot(): ClusterSnapshot;
  probe(url: string): Promise<ProbeResult>;
  getLogs(namespace: string, pod: string, container?: string): LogLine[];
  applyYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>>;
  deleteYaml(yamlText: string): Promise<Result<AppliedResourceRef[], string>>;
}

export interface TerminalContext {
  simulator: CommandRuntime;
  /** Default namespace when a command omits `-n`. */
  namespace: string;
  /** Current editor file contents, keyed by path, for `kubectl apply -f <file>`. */
  files: Record<string, string>;
}

export interface CommandResult {
  output: string;
  isError: boolean;
  /** Signals emitted for the evidence engine. */
  signals: InvestigationSignal[];
  /** When true, the terminal should clear its buffer. */
  clear?: boolean;
}

type GetResource =
  | "pods"
  | "services"
  | "deployments"
  | "replicasets"
  | "endpoints"
  | "endpointslices"
  | "events"
  | "namespaces"
  | "all";

export type Command =
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "curl"; url: string }
  | { kind: "dig"; name: string }
  | {
      kind: "get";
      resource: GetResource;
      name?: string;
      outputYaml: boolean;
      namespace?: string;
      sortByLastTimestamp: boolean;
    }
  | {
      kind: "describe";
      resource: "pod" | "service" | "deployment";
      name: string;
      namespace?: string;
    }
  | { kind: "logs"; pod: string; container?: string; namespace?: string }
  | { kind: "apply"; file: string }
  | { kind: "delete"; file: string }
  | { kind: "unsupported"; message: string };

// ---------------------------------------------------------------------------
// Tokenizer + parser
// ---------------------------------------------------------------------------

/** Split a command line into tokens, honoring single and double quotes. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}

const GET_RESOURCE_ALIASES: Record<string, GetResource> = {
  pod: "pods",
  pods: "pods",
  po: "pods",
  svc: "services",
  service: "services",
  services: "services",
  deploy: "deployments",
  deployment: "deployments",
  deployments: "deployments",
  rs: "replicasets",
  replicaset: "replicasets",
  replicasets: "replicasets",
  ep: "endpoints",
  endpoint: "endpoints",
  endpoints: "endpoints",
  endpointslice: "endpointslices",
  endpointslices: "endpointslices",
  eps: "endpointslices",
  event: "events",
  events: "events",
  ev: "events",
  ns: "namespaces",
  namespace: "namespaces",
  namespaces: "namespaces",
  all: "all",
};

interface ParsedArgs {
  positionals: string[];
  outputYaml: boolean;
  namespace?: string;
  container?: string;
  file?: string;
  sortByLastTimestamp: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const parsed: ParsedArgs = { positionals, outputYaml: false, sortByLastTimestamp: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "-o" || arg === "--output") {
      parsed.outputYaml = (args[++i] ?? "") === "yaml";
    } else if (arg.startsWith("-o=") || arg.startsWith("--output=")) {
      parsed.outputYaml = arg.split("=")[1] === "yaml";
    } else if (arg === "-oyaml") {
      parsed.outputYaml = true;
    } else if (arg === "-n" || arg === "--namespace") {
      parsed.namespace = args[++i];
    } else if (arg.startsWith("--namespace=")) {
      parsed.namespace = arg.split("=")[1];
    } else if (arg === "-c" || arg === "--container") {
      parsed.container = args[++i];
    } else if (arg === "-f" || arg === "--filename") {
      parsed.file = args[++i];
    } else if (arg.startsWith("-f=") || arg.startsWith("--filename=")) {
      parsed.file = arg.split("=")[1];
    } else if (arg.startsWith("--sort-by")) {
      parsed.sortByLastTimestamp = arg.includes("lastTimestamp") || !arg.includes("=");
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }
  return parsed;
}

export function parseCommand(line: string): Command {
  const tokens = tokenize(line.trim());
  const head = tokens[0];
  if (!head) return { kind: "unsupported", message: "" };

  switch (head) {
    case "clear":
      return { kind: "clear" };
    case "help":
    case "--help":
    case "-h":
      return { kind: "help" };
    case "curl": {
      const url = parseArgs(tokens.slice(1)).positionals[0];
      if (!url) return unsupported("curl: no URL specified. Try: curl http://web-svc/");
      return { kind: "curl", url };
    }
    case "dig": {
      const name = parseArgs(tokens.slice(1)).positionals[0];
      if (!name) return unsupported("dig: no name specified. Try: dig web-svc");
      return { kind: "dig", name };
    }
    case "kubectl":
    case "k":
      return parseKubectl(tokens.slice(1));
    default:
      return unsupported(
        `${head}: command not found. This is a simulated shell — type 'help' for supported commands.`,
      );
  }
}

function parseKubectl(args: string[]): Command {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "get": {
      const parsed = parseArgs(rest);
      const resourceToken = parsed.positionals[0];
      if (!resourceToken)
        return unsupported("kubectl get: specify a resource, e.g. 'kubectl get pods'.");
      const resource = GET_RESOURCE_ALIASES[resourceToken.toLowerCase()];
      if (!resource) {
        return unsupported(
          `kubectl get: unknown resource "${resourceToken}". Try pods, svc, deployments, replicasets, endpoints, endpointslices, namespaces, or events.`,
        );
      }
      return {
        kind: "get",
        resource,
        name: parsed.positionals[1],
        outputYaml: parsed.outputYaml,
        namespace: parsed.namespace,
        sortByLastTimestamp: parsed.sortByLastTimestamp,
      };
    }
    case "describe": {
      const parsed = parseArgs(rest);
      const typeToken = (parsed.positionals[0] ?? "").toLowerCase();
      const name = parsed.positionals[1];
      const resource =
        GET_RESOURCE_ALIASES[typeToken] === "pods"
          ? "pod"
          : GET_RESOURCE_ALIASES[typeToken] === "services"
            ? "service"
            : GET_RESOURCE_ALIASES[typeToken] === "deployments"
              ? "deployment"
              : undefined;
      if (!resource) return unsupported("kubectl describe: supported for pod, svc, deployment.");
      if (!name) return unsupported(`kubectl describe ${typeToken}: specify a name.`);
      return { kind: "describe", resource, name, namespace: parsed.namespace };
    }
    case "logs": {
      const parsed = parseArgs(rest);
      const pod = parsed.positionals[0];
      if (!pod) return unsupported("kubectl logs: specify a pod name.");
      return { kind: "logs", pod, container: parsed.container, namespace: parsed.namespace };
    }
    case "apply": {
      const file = parseArgs(rest).file;
      if (!file)
        return unsupported(
          "kubectl apply: specify a file with -f, e.g. 'kubectl apply -f deployment.yaml'.",
        );
      return { kind: "apply", file };
    }
    case "delete": {
      const file = parseArgs(rest).file;
      if (!file)
        return unsupported(
          "kubectl delete: specify a file with -f, e.g. 'kubectl delete -f deployment.yaml'.",
        );
      return { kind: "delete", file };
    }
    default:
      return unsupported(
        `kubectl ${sub ?? ""}: unsupported subcommand. Supported: get, describe, logs, apply, delete.`,
      );
  }
}

function unsupported(message: string): Command {
  return { kind: "unsupported", message };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runCommandLine(line: string, ctx: TerminalContext): Promise<CommandResult> {
  return executeCommand(parseCommand(line), line, ctx);
}

export async function executeCommand(
  command: Command,
  rawLine: string,
  ctx: TerminalContext,
): Promise<CommandResult> {
  switch (command.kind) {
    case "clear":
      return { output: "", isError: false, signals: [], clear: true };
    case "help":
      return { output: HELP_TEXT, isError: false, signals: [] };
    case "curl":
      return runCurl(command.url, ctx);
    case "dig":
      return runDig(command.name, ctx);
    case "get":
      return runGet(command, rawLine, ctx);
    case "describe":
      return runDescribe(command, rawLine, ctx);
    case "logs":
      return runLogs(command, rawLine, ctx);
    case "apply":
      return runApply(command.file, ctx);
    case "delete":
      return runDelete(command.file, ctx);
    case "unsupported":
      return { output: command.message, isError: command.message !== "", signals: [] };
  }
}

async function runCurl(url: string, ctx: TerminalContext): Promise<CommandResult> {
  const result = await ctx.simulator.probe(url);
  const signals: InvestigationSignal[] = [createProbeSignal(url, result)];
  if (result.status === 0) {
    return {
      output: `curl: could not connect to ${url}${result.reason ? `\n${result.reason}` : ""}`,
      isError: true,
      signals,
    };
  }
  const body = result.body.trimEnd();
  return {
    output: `HTTP ${result.status}\n${body}`.trimEnd(),
    isError: false,
    signals,
  };
}

function runDig(name: string, ctx: TerminalContext): CommandResult {
  const snapshot = ctx.simulator.getSnapshot();
  const query = parseServiceDnsName(name, ctx.namespace);
  const service = snapshot.services.find(
    (s) =>
      query !== null &&
      s.metadata?.name === query.service &&
      (s.metadata?.namespace ?? "default") === query.namespace,
  );
  if (!service?.spec?.clusterIP) {
    return {
      output: `;; connection timed out; no servers could be reached\n; ${name}: NXDOMAIN`,
      isError: false,
      signals: [{ type: "command", command: `dig ${name}`, output: "NXDOMAIN" }],
    };
  }
  const fqdn = `${service.metadata?.name}.${service.metadata?.namespace}.svc.cluster.local`;
  const output = [
    `; <<>> klab dig <<>> ${name}`,
    ";; ANSWER SECTION:",
    `${fqdn}\t30\tIN\tA\t${service.spec.clusterIP}`,
  ].join("\n");
  return { output, isError: false, signals: [{ type: "command", command: `dig ${name}`, output }] };
}

/** Resolve the Service DNS forms Kubernetes exposes inside a Pod search domain. */
function parseServiceDnsName(
  rawName: string,
  defaultNamespace: string,
): { service: string; namespace: string } | null {
  const parts = rawName.replace(/\.$/, "").split(".");
  if (parts.length === 1 && parts[0]) {
    return { service: parts[0], namespace: defaultNamespace };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { service: parts[0], namespace: parts[1] };
  }
  const validSuffix =
    parts[2] === "svc" &&
    (parts.length === 3 || (parts.length === 5 && parts[3] === "cluster" && parts[4] === "local"));
  return validSuffix && parts[0] && parts[1] ? { service: parts[0], namespace: parts[1] } : null;
}

function runGet(
  command: Extract<Command, { kind: "get" }>,
  rawLine: string,
  ctx: TerminalContext,
): CommandResult {
  const snapshot = ctx.simulator.getSnapshot();
  const namespace = command.namespace ?? ctx.namespace;
  const output = renderGet(command, namespace, snapshot);
  return {
    output,
    isError: false,
    signals: buildGetSignals(command, rawLine, output, snapshot, namespace),
  };
}

function renderGet(
  command: Extract<Command, { kind: "get" }>,
  namespace: string,
  snapshot: ClusterSnapshot,
): string {
  const { resource, name, outputYaml } = command;

  if (outputYaml && name) {
    const object = findByName(resource, name, namespace, snapshot);
    if (!object) return notFound(resource, name, namespace);
    return stringifyManifest(object);
  }

  switch (resource) {
    case "pods":
      return renderPods(inNamespace(snapshot.pods, namespace, name));
    case "services":
      return renderServices(inNamespace(snapshot.services, namespace, name), snapshot);
    case "deployments":
      return renderDeployments(inNamespace(snapshot.deployments, namespace, name));
    case "replicasets":
      return renderReplicaSets(inNamespace(snapshot.replicaSets, namespace, name));
    case "endpoints":
      return renderEndpoints(inNamespace(snapshot.services, namespace, name), snapshot);
    case "endpointslices":
      return renderEndpointSlices(inNamespace(snapshot.endpointSlices, namespace, name));
    case "events":
      return renderEvents(snapshot.events, namespace, command.sortByLastTimestamp);
    case "namespaces":
      return renderNamespaces(snapshot, name);
    case "all":
      return [
        renderPods(inNamespace(snapshot.pods, namespace)),
        "",
        renderServices(inNamespace(snapshot.services, namespace), snapshot),
        "",
        renderDeployments(inNamespace(snapshot.deployments, namespace)),
        "",
        renderReplicaSets(inNamespace(snapshot.replicaSets, namespace)),
      ].join("\n");
  }
}

function renderPods(pods: V1Pod[]): string {
  if (pods.length === 0) return "No resources found.";
  const rows = pods.map((pod) => {
    const { ready, total } = podReadyCounts(pod);
    return [
      pod.metadata?.name ?? "<unknown>",
      `${ready}/${total}`,
      podPhase(pod),
      String(podRestarts(pod)),
      humanizeAge(pod.metadata?.creationTimestamp),
    ];
  });
  return formatTable(["NAME", "READY", "STATUS", "RESTARTS", "AGE"], rows);
}

function renderServices(services: V1Service[], snapshot: ClusterSnapshot): string {
  if (services.length === 0) return "No resources found.";
  const rows = services.map((svc) => [
    svc.metadata?.name ?? "<unknown>",
    svc.spec?.type ?? "ClusterIP",
    svc.spec?.clusterIP ?? "<none>",
    "<none>",
    servicePortsSummary(svc),
    humanizeAge(svc.metadata?.creationTimestamp),
  ]);
  void snapshot;
  return formatTable(["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"], rows);
}

function renderDeployments(deployments: ClusterSnapshot["deployments"]): string {
  if (deployments.length === 0) return "No resources found.";
  const rows = deployments.map((d) => [
    d.metadata?.name ?? "<unknown>",
    `${deploymentReadyReplicas(d)}/${d.spec?.replicas ?? 0}`,
    String(d.status?.updatedReplicas ?? 0),
    String(d.status?.availableReplicas ?? 0),
    humanizeAge(d.metadata?.creationTimestamp),
  ]);
  return formatTable(["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"], rows);
}

function renderReplicaSets(replicaSets: ClusterSnapshot["replicaSets"]): string {
  if (replicaSets.length === 0) return "No resources found.";
  const rows = replicaSets.map((rs) => [
    rs.metadata?.name ?? "<unknown>",
    String(rs.spec?.replicas ?? 0),
    String(rs.status?.replicas ?? 0),
    String(rs.status?.readyReplicas ?? 0),
    humanizeAge(rs.metadata?.creationTimestamp),
  ]);
  return formatTable(["NAME", "DESIRED", "CURRENT", "READY", "AGE"], rows);
}

function renderEndpoints(services: V1Service[], snapshot: ClusterSnapshot): string {
  if (services.length === 0) return "No resources found.";
  const rows = services.map((svc) => {
    const addresses = readyAddresses(svc, snapshot);
    return [
      svc.metadata?.name ?? "<unknown>",
      addresses.length > 0 ? addresses.join(",") : "<none>",
      humanizeAge(svc.metadata?.creationTimestamp),
    ];
  });
  return formatTable(["NAME", "ENDPOINTS", "AGE"], rows);
}

function renderNamespaces(snapshot: ClusterSnapshot, name?: string): string {
  const namespaces = snapshot.namespaces.filter(
    (n) => name === undefined || n.metadata?.name === name,
  );
  if (namespaces.length === 0) return "No resources found.";
  const rows = namespaces.map((n) => [
    n.metadata?.name ?? "<unknown>",
    n.status?.phase ?? "Active",
    humanizeAge(n.metadata?.creationTimestamp),
  ]);
  return formatTable(["NAME", "STATUS", "AGE"], rows);
}

function renderEndpointSlices(slices: ClusterSnapshot["endpointSlices"]): string {
  if (slices.length === 0) return "No resources found.";
  const rows = slices.map((slice) => {
    const ports = (slice.ports ?? []).map((p) => String(p.port ?? "")).join(",") || "<none>";
    const addresses = (slice.endpoints ?? []).flatMap((e) => e.addresses ?? []);
    return [
      slice.metadata?.name ?? "<unknown>",
      slice.addressType ?? "IPv4",
      ports,
      addresses.length > 0 ? addresses.join(",") : "<none>",
      humanizeAge(slice.metadata?.creationTimestamp),
    ];
  });
  return formatTable(["NAME", "ADDRESSTYPE", "PORTS", "ENDPOINTS", "AGE"], rows);
}

function renderEvents(
  events: CoreV1Event[],
  namespace: string,
  sortByLastTimestamp: boolean,
): string {
  const filtered = events.filter((e) => (e.metadata?.namespace ?? "default") === namespace);
  if (filtered.length === 0) return "No events found.";
  const sorted = sortByLastTimestamp
    ? [...filtered].sort((a, b) => timeOf(a) - timeOf(b))
    : filtered;
  const rows = sorted.map((e) => [
    eventAge(e),
    e.type ?? "Normal",
    e.reason ?? "",
    `${e.involvedObject?.kind ?? ""}/${e.involvedObject?.name ?? ""}`,
    e.message ?? "",
  ]);
  return formatTable(["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], rows);
}

function runDescribe(
  command: Extract<Command, { kind: "describe" }>,
  rawLine: string,
  ctx: TerminalContext,
): CommandResult {
  const snapshot = ctx.simulator.getSnapshot();
  const namespace = command.namespace ?? ctx.namespace;
  let output: string;
  if (command.resource === "pod") {
    const pod = snapshot.pods.find(
      (p) =>
        p.metadata?.name === command.name && (p.metadata?.namespace ?? "default") === namespace,
    );
    output = pod ? describePod(pod, snapshot) : notFound("pod", command.name, namespace);
  } else if (command.resource === "service") {
    const svc = snapshot.services.find(
      (s) =>
        s.metadata?.name === command.name && (s.metadata?.namespace ?? "default") === namespace,
    );
    output = svc ? describeService(svc, snapshot) : notFound("service", command.name, namespace);
  } else {
    const dep = snapshot.deployments.find(
      (d) =>
        d.metadata?.name === command.name && (d.metadata?.namespace ?? "default") === namespace,
    );
    output = dep
      ? [
          `Name:               ${dep.metadata?.name}`,
          `Namespace:          ${dep.metadata?.namespace ?? "default"}`,
          `Replicas:           ${deploymentReadyReplicas(dep)} ready / ${dep.spec?.replicas ?? 0} desired`,
          `Selector:           ${formatSelector(dep.spec?.selector?.matchLabels)}`,
        ].join("\n")
      : notFound("deployment", command.name, namespace);
  }
  return {
    output,
    isError: false,
    signals: [{ type: "command", command: rawLine, output }],
  };
}

function describePod(pod: V1Pod, snapshot: ClusterSnapshot): string {
  const name = pod.metadata?.name ?? "<unknown>";
  const readyCond = (pod.status?.conditions ?? []).find((c) => c.type === "Ready");
  const lines = [
    `Name:             ${name}`,
    `Namespace:        ${pod.metadata?.namespace ?? "default"}`,
    `Node:             ${pod.spec?.nodeName ?? "<none>"}`,
    `Status:           ${podPhase(pod)}`,
    `IP:               ${pod.status?.podIP ?? "<none>"}`,
    `Labels:           ${formatSelector(pod.metadata?.labels)}`,
    `Termination Grace Period: ${pod.spec?.terminationGracePeriodSeconds ?? 30}s`,
    "Containers:",
  ];

  for (const container of pod.spec?.containers ?? []) {
    const status = (pod.status?.containerStatuses ?? []).find(
      (candidate) => candidate.name === container.name,
    );
    lines.push(
      `  ${container.name}:`,
      `    Image:          ${container.image ?? "<none>"}`,
      `    Port:           ${containerPortsSummary(container)}`,
      `    Ready:          ${status?.ready ? "True" : "False"}`,
      `    Restart Count:  ${status?.restartCount ?? 0}`,
    );
    if ((container.command ?? []).length > 0) {
      lines.push(`    Command:        ${container.command!.join(" ")}`);
    }
    if ((container.args ?? []).length > 0) {
      lines.push(`    Args:           ${container.args!.join(" ")}`);
    }
    if (container.lifecycle?.preStop?.exec?.command?.length) {
      lines.push(`    PreStop:        exec ${container.lifecycle.preStop.exec.command.join(" ")}`);
    }
    const env = container.env ?? [];
    if (env.length > 0) {
      lines.push("    Environment:");
      for (const entry of env) {
        lines.push(`      ${entry.name}:  ${entry.value ?? "<set from source>"}`);
      }
    }
    if (container.startupProbe?.httpGet) {
      const probe = container.startupProbe.httpGet;
      lines.push(
        `    Startup:        http-get ${probe.path ?? "/"} port ${String(probe.port ?? "")}`,
      );
    }
    if (container.readinessProbe?.httpGet) {
      const probe = container.readinessProbe.httpGet;
      lines.push(
        `    Readiness:      http-get ${probe.path ?? "/"} port ${String(probe.port ?? "")}`,
      );
    }
    if (container.livenessProbe?.httpGet) {
      const probe = container.livenessProbe.httpGet;
      lines.push(
        `    Liveness:       http-get ${probe.path ?? "/"} port ${String(probe.port ?? "")}`,
      );
    }
  }
  lines.push(`Conditions:`, `  Ready           ${readyCond?.status ?? "Unknown"}`);
  const events = relatedEvents(snapshot.events, name);
  if (events.length > 0) {
    lines.push("Events:");
    for (const e of events) {
      lines.push(`  ${e.type ?? "Normal"}  ${e.reason ?? ""}  ${e.message ?? ""}`);
    }
  }
  return lines.join("\n");
}

function describeService(svc: V1Service, snapshot: ClusterSnapshot): string {
  const addresses = readyAddresses(svc, snapshot);
  const targetPorts =
    (svc.spec?.ports ?? [])
      .map((p) => String(p.targetPort ?? p.port ?? ""))
      .filter(Boolean)
      .map((p) => `${p}/TCP`)
      .join(",") || "<none>";
  return [
    `Name:              ${svc.metadata?.name}`,
    `Namespace:         ${svc.metadata?.namespace ?? "default"}`,
    `Selector:          ${formatSelector(svc.spec?.selector)}`,
    `Type:              ${svc.spec?.type ?? "ClusterIP"}`,
    `IP:                ${svc.spec?.clusterIP ?? "<none>"}`,
    `Port:              ${servicePortsSummary(svc)}`,
    `TargetPort:        ${targetPorts}`,
    `Endpoints:         ${addresses.length > 0 ? addresses.join(",") : "<none>"}`,
  ].join("\n");
}

function runLogs(
  command: Extract<Command, { kind: "logs" }>,
  rawLine: string,
  ctx: TerminalContext,
): CommandResult {
  const snapshot = ctx.simulator.getSnapshot();
  const namespace = command.namespace ?? ctx.namespace;
  const pod = snapshot.pods.find(
    (p) => p.metadata?.name === command.pod && (p.metadata?.namespace ?? "default") === namespace,
  );
  if (!pod) return { output: notFound("pod", command.pod, namespace), isError: true, signals: [] };
  const lines = ctx.simulator.getLogs(namespace, command.pod, command.container);
  const output =
    lines.length > 0
      ? lines.map((l) => l.message).join("\n")
      : `No logs yet for pod/${command.pod}.`;
  return { output, isError: false, signals: [{ type: "command", command: rawLine, output }] };
}

async function runApply(file: string, ctx: TerminalContext): Promise<CommandResult> {
  const content = ctx.files[file];
  if (content === undefined) {
    return {
      output: `error: the path "${file}" does not exist. Available files: ${Object.keys(ctx.files).join(", ") || "(none)"}.`,
      isError: true,
      signals: [],
    };
  }
  const result = await ctx.simulator.applyYaml(content);
  if (!result.ok) return { output: `error: ${result.error}`, isError: true, signals: [] };
  const output = result.value.map((r) => `${r.kind.toLowerCase()}/${r.name} configured`).join("\n");
  return { output: output || "no resources to apply", isError: false, signals: [] };
}

async function runDelete(file: string, ctx: TerminalContext): Promise<CommandResult> {
  const content = ctx.files[file];
  if (content === undefined) {
    return { output: `error: the path "${file}" does not exist.`, isError: true, signals: [] };
  }
  const result = await ctx.simulator.deleteYaml(content);
  if (!result.ok) return { output: `error: ${result.error}`, isError: true, signals: [] };
  const output = result.value.map((r) => `${r.kind.toLowerCase()}/${r.name} deleted`).join("\n");
  return { output: output || "no resources to delete", isError: false, signals: [] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGetSignals(
  command: Extract<Command, { kind: "get" }>,
  rawLine: string,
  output: string,
  snapshot: ClusterSnapshot,
  namespace: string,
): InvestigationSignal[] {
  const signals: InvestigationSignal[] = [{ type: "command", command: rawLine, output }];
  // Viewing events also surfaces their reasons as evidence signals.
  if (command.resource === "events") {
    for (const event of snapshot.events) {
      if ((event.metadata?.namespace ?? "default") !== namespace) continue;
      if (event.reason) {
        signals.push({
          type: "event-reason",
          reason: event.reason,
          message: event.message ?? "",
          namespace,
        });
      }
    }
  }
  return signals;
}

function inNamespace<T extends { metadata?: { name?: string; namespace?: string } }>(
  items: T[],
  namespace: string,
  name?: string,
): T[] {
  return items.filter(
    (item) =>
      (item.metadata?.namespace ?? "default") === namespace &&
      (name === undefined || item.metadata?.name === name),
  );
}

function findByName(
  resource: GetResource,
  name: string,
  namespace: string,
  snapshot: ClusterSnapshot,
): unknown {
  const map: Partial<Record<GetResource, { metadata?: { name?: string; namespace?: string } }[]>> =
    {
      pods: snapshot.pods,
      services: snapshot.services,
      deployments: snapshot.deployments,
      replicasets: snapshot.replicaSets,
      endpointslices: snapshot.endpointSlices,
    };
  return (map[resource] ?? []).find(
    (item) => item.metadata?.name === name && (item.metadata?.namespace ?? "default") === namespace,
  );
}

function readyAddresses(service: V1Service, snapshot: ClusterSnapshot): string[] {
  const serviceName = service.metadata?.name;
  const namespace = service.metadata?.namespace;
  const addresses: string[] = [];
  for (const slice of snapshot.endpointSlices) {
    if (slice.metadata?.namespace !== namespace) continue;
    if (slice.metadata?.labels?.["kubernetes.io/service-name"] !== serviceName) continue;
    for (const endpoint of slice.endpoints ?? []) {
      if (endpoint.conditions?.ready === false) continue;
      addresses.push(...(endpoint.addresses ?? []));
    }
  }
  return addresses;
}

function relatedEvents(events: CoreV1Event[], objectName: string): CoreV1Event[] {
  return events
    .filter((e) => e.involvedObject?.name === objectName)
    .sort((a, b) => timeOf(a) - timeOf(b))
    .slice(-8);
}

function timeOf(event: CoreV1Event): number {
  const value = event.lastTimestamp ?? event.eventTime ?? event.metadata?.creationTimestamp;
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isNaN(ms) ? 0 : ms;
}

function containerPortsSummary(container: V1Container | undefined): string {
  const ports = container?.ports ?? [];
  if (ports.length === 0) return "<none>";
  return ports.map((p) => `${p.containerPort ?? "?"}/TCP`).join(",");
}

function formatSelector(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "<none>";
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function notFound(resource: string, name: string, namespace: string): string {
  return `Error from server (NotFound): ${resource} "${name}" not found in namespace "${namespace}".`;
}

const HELP_TEXT = [
  "klab simulated shell — supported commands:",
  "",
  "  kubectl get pods|svc|deployments|replicasets|endpoints|endpointslices|namespaces|events",
  "  kubectl get <resource> <name> -o yaml",
  "  kubectl get events --sort-by=.lastTimestamp",
  "  kubectl describe pod|svc|deployment <name>",
  "  kubectl logs <pod> [-c <container>]",
  "  kubectl apply -f <file>",
  "  kubectl delete -f <file>",
  "  curl <url>              probe a Service or pod URL",
  "  dig <service>          resolve a Service's cluster IP",
  "  clear                  clear the terminal (Ctrl+L)",
  "  help                   show this message",
  "",
  "Flags: -n <namespace>, -o yaml. This is a learning simulator, not a real shell.",
].join("\n");
