import type { ProblemCapability, ProblemEngineSpec, ProblemLevel } from "@/lib/domain/types";

import { scriptedScenarioCapabilities } from "./scripted-scenarios";

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

export function capabilitiesForEngine(spec: ProblemEngineSpec): ReadonlySet<ProblemCapability> {
  return spec.kind === "webernetes"
    ? WEBERNETES_CAPABILITIES
    : scriptedScenarioCapabilities(spec.scenarioId);
}

export function unsupportedProblemCapabilities(level: ProblemLevel): ProblemCapability[] {
  const supported = capabilitiesForEngine(level.engine);
  return level.capabilities.filter((capability) => !supported.has(capability));
}
