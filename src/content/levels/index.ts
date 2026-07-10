import { parseLevel } from "@/lib/domain/schemas";
import type { Difficulty, KubernetesConcept, ProblemLevel, Severity } from "@/lib/domain/types";

import { brokenReadinessProbe } from "./broken-readiness-probe";
import { brokenServiceChain } from "./broken-service-chain";
import { configDrift } from "./config-drift";
import { dnsResolutionFailure } from "./dns-resolution-failure";
import { livenessProbeDeathSpiral } from "./liveness-probe-death-spiral";
import { namespaceConfusion } from "./namespace-confusion";
import { podCrashloopMystery } from "./pod-crashloop-mystery";
import { portRoutingBug } from "./port-routing-bug";
import { privateRegistryPullSecret } from "./private-registry-pull-secret";
import { rollingUpdateGoneWrong } from "./rolling-update-gone-wrong";
import { serviceHasNoEndpoints } from "./service-has-no-endpoints";
import { serviceSelectorMismatch } from "./service-selector-mismatch";
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
  serviceHasNoEndpoints,
  podCrashloopMystery,
  privateRegistryPullSecret,
  rollingUpdateGoneWrong,
  dnsResolutionFailure,
  livenessProbeDeathSpiral,
  configDrift,
  brokenServiceChain,
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
  concepts: KubernetesConcept[];
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
  concepts: level.concepts,
  blurb: level.blurb,
}));

/**
 * Advanced levels unlock after this many solves (any difficulty). Keeps the early
 * catalog approachable while giving the padlocked tier from the reference design a
 * real, progress-based meaning.
 */
export const ADVANCED_UNLOCK_SOLVES = 2;

export function isLevelLocked(difficulty: Difficulty, solvedCount: number): boolean {
  return difficulty === "advanced" && solvedCount < ADVANCED_UNLOCK_SOLVES;
}
