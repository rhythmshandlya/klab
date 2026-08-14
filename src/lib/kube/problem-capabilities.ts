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

/**
 * A fixture renders whatever its author declared, so it can portray any object kind
 * and any Pod state the incident calls for. What it cannot do is *animate* a control
 * loop: it shows the cluster before and after the fix, not the reconciliation in
 * between. Levels that need live reconciliation belong on Webernetes.
 */
export const FIXTURE_CAPABILITIES: ReadonlySet<ProblemCapability> = new Set([
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
  "image-pulls",
  "container-restarts",
  "container-lifecycle",
  "multi-container",
  "configmaps",
  "secrets",
  "workload-controllers",
  "network-policy",
  "scheduling",
]);

export function capabilitiesForEngine(spec: ProblemEngineSpec): ReadonlySet<ProblemCapability> {
  if (spec.kind === "webernetes") return WEBERNETES_CAPABILITIES;
  if (spec.kind === "fixture") return FIXTURE_CAPABILITIES;
  return scriptedScenarioCapabilities(spec.scenarioId);
}

export function unsupportedProblemCapabilities(level: ProblemLevel): ProblemCapability[] {
  const supported = capabilitiesForEngine(level.engine);
  return level.capabilities.filter((capability) => !supported.has(capability));
}
