import { parseLevel } from "@/lib/domain/schemas";
import type { Difficulty, KubernetesConcept, ProblemLevel, Severity } from "@/lib/domain/types";

import { brokenReadinessProbe } from "./broken-readiness-probe";

/**
 * Level registry. Each fully-authored level is validated against its Zod schema at
 * module load — an invalid level fails the build, giving us build-time validation.
 */
export const LEVELS: readonly ProblemLevel[] = [parseLevel(brokenReadinessProbe)];

export function getLevelBySlug(slug: string): ProblemLevel | undefined {
  return LEVELS.find((level) => level.slug === slug);
}

/** Catalog entry for the /problems list — includes upcoming levels not yet authored. */
export interface LevelSummary {
  slug: string;
  title: string;
  difficulty: Difficulty;
  severity: Severity;
  xp: number;
  concepts: KubernetesConcept[];
  blurb: string;
  status: "available" | "coming-soon";
}

const readiness = LEVELS[0]!;

/**
 * The initial level set from the brief. Only the reference level is playable today;
 * the rest are listed as upcoming so the catalog reflects the roadmap honestly.
 */
export const LEVEL_CATALOG: readonly LevelSummary[] = [
  {
    slug: "service-selector-mismatch",
    title: "Service Selector Mismatch",
    difficulty: "beginner",
    severity: "high",
    xp: 200,
    concepts: ["services", "labels-selectors", "endpoints"],
    blurb: "A Service selects labels no pod has, so it never gets endpoints.",
    status: "coming-soon",
  },
  {
    slug: "port-routing-bug",
    title: "Port Routing Bug",
    difficulty: "beginner",
    severity: "medium",
    xp: 200,
    concepts: ["services", "networking"],
    blurb: "The Service targets the wrong container port and traffic goes nowhere.",
    status: "coming-soon",
  },
  {
    slug: readiness.slug,
    title: readiness.title,
    difficulty: readiness.difficulty,
    severity: readiness.severity,
    xp: readiness.xp,
    concepts: readiness.concepts,
    blurb: "Pods run but never go Ready, and the Service serves 503s. Find out why.",
    status: "available",
  },
  {
    slug: "namespace-confusion",
    title: "Namespace Confusion",
    difficulty: "intermediate",
    severity: "medium",
    xp: 300,
    concepts: ["namespaces", "dns", "services"],
    blurb: "A client resolves a Service in the wrong namespace.",
    status: "coming-soon",
  },
  {
    slug: "rolling-update-gone-wrong",
    title: "Rolling Update Gone Wrong",
    difficulty: "advanced",
    severity: "critical",
    xp: 400,
    concepts: ["deployments", "rollouts", "replicasets"],
    blurb: "A bad image tag leaves a rollout stuck between two ReplicaSets.",
    status: "coming-soon",
  },
];
