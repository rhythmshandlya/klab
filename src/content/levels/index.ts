import { parseLevel } from "@/lib/domain/schemas";
import type {
  Difficulty,
  IncidentSource,
  KubernetesConcept,
  KubernetesVersionRange,
  ProblemCapability,
  ProblemChallengeMode,
  ProblemLearningPath,
  ProblemLevel,
  Severity,
} from "@/lib/domain/types";

import { brokenReadinessProbe } from "./broken-readiness-probe";
import { brokenServiceChain } from "./broken-service-chain";
import { commandOverrideCrash } from "./command-override-crash";
import { configDrift } from "./config-drift";
import { dnsResolutionFailure } from "./dns-resolution-failure";
import { gracefulShutdown502s } from "./graceful-shutdown-502s";
import { healthyAppBrokenSidecar } from "./healthy-app-broken-sidecar";
import { immutableDeploymentSelector } from "./immutable-deployment-selector";
import { livenessProbeDeathSpiral } from "./liveness-probe-death-spiral";
import { namespaceConfusion } from "./namespace-confusion";
import { podCrashloopMystery } from "./pod-crashloop-mystery";
import { portRoutingBug } from "./port-routing-bug";
import { privateRegistryPullSecret } from "./private-registry-pull-secret";
import { probeHitsWrongPort } from "./probe-hits-wrong-port";
import { recreateStrategyOutage } from "./recreate-strategy-outage";
import { rollingUpdateGoneWrong } from "./rolling-update-gone-wrong";
import { rolloutCannotFitMaxsurge } from "./rollout-cannot-fit-maxsurge";
import { serviceHasNoEndpoints } from "./service-has-no-endpoints";
import { serviceSelectorMismatch } from "./service-selector-mismatch";
import { slowStartWithoutStartupProbe } from "./slow-start-without-startup-probe";
import { zombieReplicaset } from "./zombie-replicaset";

/**
 * Level registry, in catalog display order (beginner → advanced, matching the
 * problems-dashboard reference). Every level is validated against its Zod schema at
 * module load — an invalid level fails the build, giving us build-time validation.
 */
export const LEVELS: readonly ProblemLevel[] = [
  serviceSelectorMismatch,
  portRoutingBug,
  brokenReadinessProbe,
  namespaceConfusion,
  commandOverrideCrash,
  serviceHasNoEndpoints,
  podCrashloopMystery,
  privateRegistryPullSecret,
  rollingUpdateGoneWrong,
  recreateStrategyOutage,
  immutableDeploymentSelector,
  dnsResolutionFailure,
  slowStartWithoutStartupProbe,
  probeHitsWrongPort,
  livenessProbeDeathSpiral,
  configDrift,
  brokenServiceChain,
  healthyAppBrokenSidecar,
  gracefulShutdown502s,
  rolloutCannotFitMaxsurge,
  zombieReplicaset,
].map(parseLevel);

export function getLevelBySlug(slug: string): ProblemLevel | undefined {
  return LEVELS.find((level) => level.slug === slug);
}

/** Catalog entry for the /problems dashboard — a projection of a fully-authored level. */
export interface LevelSummary {
  slug: string;
  title: string;
  difficulty: Difficulty;
  severity: Severity;
  xp: number;
  estimatedMinutes: number;
  successRate: number;
  statsSource: "authored-estimate" | "client-validated";
  statsSampleSize?: number;
  challengeMode: ProblemChallengeMode;
  concepts: KubernetesConcept[];
  learningObjectives: string[];
  prerequisites: string[];
  learningPaths: ProblemLearningPath[];
  capabilities: ProblemCapability[];
  kubernetesVersion: KubernetesVersionRange;
  incidentSource?: IncidentSource;
  blurb: string;
}

/** Every catalog entry is a playable level (no more "coming soon" placeholders). */
export const LEVEL_CATALOG: readonly LevelSummary[] = LEVELS.map((level) => ({
  slug: level.slug,
  title: level.title,
  difficulty: level.difficulty,
  severity: level.severity,
  xp: level.xp,
  estimatedMinutes: level.estimatedMinutes,
  successRate: level.successRate,
  statsSource: "authored-estimate",
  challengeMode: level.challengeMode,
  concepts: level.concepts,
  learningObjectives: level.learningObjectives,
  prerequisites: level.prerequisites,
  learningPaths: level.learningPaths,
  capabilities: level.capabilities,
  kubernetesVersion: level.kubernetesVersion,
  incidentSource: level.incidentSource,
  blurb: level.blurb,
}));
