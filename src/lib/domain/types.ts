/**
 * Domain model for klab content: problem levels, playground templates, and docs
 * lessons. These types are the contract between static content (`src/content`) and
 * the runtime. Every static entry is validated at load time by the matching Zod
 * schema in `./schemas.ts`, so the runtime can trust these shapes.
 *
 * Kept intentionally free of any Webernetes/runtime imports — pure data.
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Severity = "low" | "medium" | "high" | "critical";

/** Concept tags used to cross-link levels ⇄ docs ⇄ templates. */
export type KubernetesConcept =
  | "pods"
  | "deployments"
  | "replicasets"
  | "services"
  | "endpoints"
  | "endpointslices"
  | "labels-selectors"
  | "readiness-probes"
  | "liveness-probes"
  | "dns"
  | "namespaces"
  | "rollouts"
  | "events"
  | "reconciliation"
  | "networking"
  | "debugging";

export type EditableFileLanguage = "yaml" | "json" | "typescript" | "markdown";

export interface EditableFile {
  path: string;
  language: EditableFileLanguage;
  initialValue: string;
}

export interface ReadonlyFile {
  path: string;
  language: EditableFileLanguage;
  value: string;
}

/** A hard rule the learner must respect while solving (e.g. "only edit deployment.yaml"). */
export interface LevelConstraint {
  id: string;
  label: string;
}

export type EvidenceRuleId = string;

export type EvidenceSource =
  "terminal" | "events" | "network" | "topology" | "object-explorer" | "validator";

/** A fact the learner can surface through investigation. Starts uncollected. */
export interface EvidenceItem {
  id: string;
  label: string;
  collected: boolean;
  source: EvidenceSource;
  timestamp?: string;
}

/**
 * Declarative trigger that marks an evidence item collected. Matched against
 * `InvestigationSignal`s emitted by the terminal/probe/explorer (see
 * `lib/kube/evidence.ts`). Discriminated on `type` for exhaustive handling.
 */
export type EvidenceTrigger =
  | { type: "command"; commandMatches: string; outputMatches?: string }
  | { type: "probe"; pathMatches: string; status: number }
  | { type: "event-reason"; reason: string };

export interface EvidenceRule {
  id: EvidenceRuleId;
  evidenceId: string;
  label: string;
  source: EvidenceSource;
  trigger: EvidenceTrigger;
}

export interface Hint {
  id: string;
  title: string;
  body: string;
  xpPenalty: number;
  /** Locked until these evidence rules have fired (progressive disclosure). */
  unlockAfter?: EvidenceRuleId[];
}

/** Metadata describing a fake image a level expects to be registered. */
export interface SimulatedImageDefinition {
  ref: string;
  description: string;
}

/**
 * Hidden validator run against real cluster behavior (not YAML text). Discriminated
 * on `kind`. Shared fields (`id`, `title`, `successLabel`, `failureLabel`) plus the
 * per-kind parameters.
 */
export type LevelValidatorDefinition = {
  id: string;
  title: string;
  successLabel: string;
  failureLabel: string;
} & ValidatorCheck;

export type ValidatorCheck =
  | {
      kind: "deployment-ready";
      namespace: string;
      name: string;
      minReadyReplicas: number;
    }
  | {
      kind: "service-has-ready-endpoints";
      namespace: string;
      name: string;
      minReadyEndpoints: number;
    }
  | {
      kind: "http-get-through-service";
      namespace: string;
      service: string;
      port: number;
      path: string;
      expectStatus: number;
    }
  | {
      kind: "no-recent-readiness-failures";
      namespace: string;
      /** Only consider probe-failure events newer than this many seconds ago. */
      withinSeconds: number;
    }
  | {
      kind: "pod-ready-by-selector";
      namespace: string;
      selector: Record<string, string>;
      minReady: number;
    };

export type ValidatorKind = ValidatorCheck["kind"];

export interface ProblemLevel {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  severity: Severity;
  xp: number;
  concepts: KubernetesConcept[];
  story: string;
  objective: string;
  constraints: LevelConstraint[];
  files: EditableFile[];
  readonlyFiles: ReadonlyFile[];
  /** Extra manifests applied at boot that the learner cannot see/edit (e.g. the Service). */
  initialManifests: string[];
  registeredImages: SimulatedImageDefinition[];
  allowedCommands: string[];
  validators: LevelValidatorDefinition[];
  hints: Hint[];
  evidenceRules: EvidenceRule[];
  postSolveExplanation: PostSolveExplanation;
}

/** Structured post-solve teaching payload shown once validation passes. */
export interface PostSolveExplanation {
  rootCause: string;
  whyItFailed: string;
  whatFixedIt: string;
  relatedConcepts: KubernetesConcept[];
  docsHref?: string;
}

export interface PlaygroundTemplate {
  id: string;
  title: string;
  description: string;
  concepts: KubernetesConcept[];
  files: EditableFile[];
  initialManifests: string[];
  registeredImages: SimulatedImageDefinition[];
}

export interface InteractiveLab {
  id: string;
  title: string;
  prompt: string;
  files: EditableFile[];
  initialManifests: string[];
  registeredImages: SimulatedImageDefinition[];
  tryChanging?: string;
}

export interface DocsLesson {
  slug: string[];
  title: string;
  description: string;
  section: string;
  order: number;
  concepts: KubernetesConcept[];
  relatedLevelSlug?: string;
  labs: InteractiveLab[];
}
