import type { ProblemCapability, ProblemEngineSpec, ProblemLevel } from "@/lib/domain/types";

export const WEBERNETES_CAPABILITIES: ReadonlySet<ProblemCapability> = new Set([
  "pods",
  "services",
  "deployments",
  "replicasets",
  "namespaces",
  "nodes",
  "events",
  "logs",
  "http-probes",
  "dns",
  "rollouts",
  "container-restarts",
  "container-lifecycle",
  "multi-container",
]);

const SCRIPTED_SCENARIO_CAPABILITIES: Readonly<Record<string, ReadonlySet<ProblemCapability>>> = {
  "private-registry-pull": new Set([
    "pods",
    "services",
    "deployments",
    "events",
    "http-probes",
    "image-pulls",
    "secrets",
  ]),
};

export function capabilitiesForEngine(spec: ProblemEngineSpec): ReadonlySet<ProblemCapability> {
  return spec.kind === "webernetes"
    ? WEBERNETES_CAPABILITIES
    : (SCRIPTED_SCENARIO_CAPABILITIES[spec.scenarioId] ?? new Set());
}

export function unsupportedProblemCapabilities(level: ProblemLevel): ProblemCapability[] {
  const supported = capabilitiesForEngine(level.engine);
  return level.capabilities.filter((capability) => !supported.has(capability));
}
