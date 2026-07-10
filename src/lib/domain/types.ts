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
  | "statefulsets"
  | "daemonsets"
  | "jobs"
  | "cronjobs"
  | "services"
  | "ingress"
  | "gateway-api"
  | "endpoints"
  | "endpointslices"
  | "labels-selectors"
  | "annotations"
  | "owners-gc"
  | "readiness-probes"
  | "liveness-probes"
  | "startup-probes"
  | "init-containers"
  | "sidecar-containers"
  | "lifecycle-hooks"
  | "dns"
  | "namespaces"
  | "rollouts"
  | "disruptions"
  | "events"
  | "logs"
  | "resources"
  | "resource-quotas"
  | "limit-ranges"
  | "configmaps"
  | "secrets"
  | "storage"
  | "service-accounts"
  | "rbac"
  | "security-contexts"
  | "network-policies"
  | "scheduling"
  | "autoscaling"
  | "object-management"
  | "kustomize"
  | "crds"
  | "operators"
  | "admission-controllers"
  | "reconciliation"
  | "networking"
  | "debugging";

export type EditableFileLanguage = "yaml" | "json" | "typescript" | "markdown";

export interface EditableFile {
  path: string;
  language: EditableFileLanguage;
  initialValue: string;
}

export type ProblemFileAccess = "editable" | "readonly" | "hidden";

/** A scenario file and its complete workspace/runtime behavior. */
export interface ProblemFile extends EditableFile {
  access: ProblemFileAccess;
  /** Apply this manifest while constructing/resetting the incident state. */
  applyAtBoot: boolean;
}

export interface ManifestResourceSelector {
  kind: string;
  name: string;
  namespace?: string;
}

export type ManifestAssertion =
  | { path: string; operator: "present" }
  | { path: string; operator: "absent" }
  | {
      path: string;
      operator: "equals" | "not-equals" | "gte" | "lte" | "matches";
      value: string | number | boolean;
    };

/** A hard rule that is both displayed and evaluated during every validation. */
export type LevelConstraint = {
  id: string;
  label: string;
} & (
  | { kind: "editable-files"; paths: string[] }
  | {
      kind: "manifest";
      file: string;
      resource: ManifestResourceSelector;
      /** Reject extra documents smuggled into a single-resource learner file. */
      exclusive: boolean;
      assertions: ManifestAssertion[];
    }
);

export interface QuickCommandTarget {
  kind: "pod";
  namespace: string;
  selector: Record<string, string>;
  prefer: "not-ready" | "highest-restarts" | "first";
}

export interface QuickCommand {
  id: string;
  command: string;
  target?: QuickCommandTarget;
}

export type ProblemEngineSpec = { kind: "webernetes" } | { kind: "scripted"; scenarioId: string };

export type ProblemBootWait =
  | {
      kind: "pods-ready";
      namespace: string;
      selector: Record<string, string>;
      minReady: number;
      timeoutMs: number;
    }
  | {
      kind: "pod-image-present";
      namespace: string;
      image: string;
      minCount: number;
      timeoutMs: number;
    };

export interface ProblemBootStep {
  id: string;
  filePaths: string[];
  waitFor?: ProblemBootWait;
}

export type EvidenceRuleId = string;

export type EvidenceSource =
  "terminal" | "logs" | "events" | "network" | "topology" | "object-explorer" | "validator";

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
  | {
      type: "probe";
      hostMatches: string;
      pathMatches: string;
      status: number;
      bodyMatches?: string;
    }
  | { type: "event-reason"; reason: string; messageMatches?: string }
  | { type: "log"; messageMatches: string; podMatches?: string; namespace?: string }
  | { type: "object-view"; kind: string; nameMatches: string; namespace?: string }
  | { type: "topology-view"; kind: string; nameMatches: string; namespace?: string }
  | { type: "validator"; validatorId: string; passed: boolean };

export interface EvidenceRule {
  id: EvidenceRuleId;
  evidenceId: string;
  label: string;
  /**
   * Neutral description of the investigative act (e.g. "Service endpoints inspected"),
   * shown on the evidence board BEFORE the item is collected. Describes what to look
   * at without revealing what will be found. Falls back to a generic placeholder.
   */
  hiddenLabel?: string;
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
    }
  | {
      /** At least one pod matches AND no matching pod has restarted more than maxRestarts times. */
      kind: "pod-restarts-below";
      namespace: string;
      selector: Record<string, string>;
      maxRestarts: number;
    }
  | {
      /** Passes when ZERO pods match the selector (e.g. a zombie workload was retired). */
      kind: "no-pods-matching";
      namespace: string;
      selector: Record<string, string>;
    };

export type ValidatorKind = ValidatorCheck["kind"];

export interface ProblemLevel {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  severity: Severity;
  xp: number;
  /** Author-estimated time to solve, shown in the catalog. */
  estimatedMinutes: number;
  /** Author-estimated solve rate (0–100), shown in the catalog. */
  successRate: number;
  concepts: KubernetesConcept[];
  /** One-line teaser for lists/tables (story is the full in-level briefing). */
  blurb: string;
  story: string;
  objective: string;
  engine: ProblemEngineSpec;
  constraints: LevelConstraint[];
  files: ProblemFile[];
  /** Ordered incident construction; omitted when all applyAtBoot files form one step. */
  bootSequence?: ProblemBootStep[];
  quickCommands: QuickCommand[];
  /** Preset URLs for the network-probe panel (level-specific service names). */
  probeTargets: string[];
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
  tasks?: string[];
  commands?: string[];
  debrief?: string;
}

/**
 * A block of docs lesson content. A small typed vocabulary (instead of MDX) that the
 * renderer maps to components — keeps content Zod-validated and free of a build-time
 * MDX pipeline. `heading` blocks provide the anchors for the table of contents;
 * `lab` blocks embed an interactive lab by id.
 */
export type DocsBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "paragraph"; text: string }
  | { type: "callout"; tone: "info" | "warning" | "key"; title?: string; text: string }
  | { type: "concept"; term: string; definition: string }
  | { type: "code"; language: EditableFileLanguage; code: string }
  | {
      type: "diagram";
      variant:
        | "control-loop"
        | "cluster-architecture"
        | "api-object"
        | "pod"
        | "workload-hierarchy"
        | "service-routing"
        | "probe-gates"
        | "rollout"
        | "namespace-boundary"
        | "debug-loop";
      title?: string;
      caption?: string;
    }
  | {
      type: "demo";
      title: string;
      description: string;
      steps: { label: string; detail: string; command?: string; output?: string }[];
    }
  | {
      type: "quiz";
      id: string;
      question: string;
      options: { id: string; text: string; correct: boolean; explanation: string }[];
    }
  | { type: "steps"; title?: string; items: { title: string; text: string }[] }
  | { type: "takeaways"; items: string[] }
  | {
      type: "compare";
      caption?: string;
      left: { title: string; code: string };
      right: { title: string; code: string };
    }
  | {
      type: "annotatedCode";
      language: EditableFileLanguage;
      title?: string;
      caption?: string;
      lines: { code: string; note?: string }[];
    }
  | {
      type: "buildUp";
      language: EditableFileLanguage;
      title?: string;
      stages: { label: string; note: string; code: string }[];
    }
  | {
      type: "spotTheBug";
      language: EditableFileLanguage;
      title?: string;
      prompt: string;
      code: string;
      answer: string;
    }
  | {
      type: "challenge";
      language: EditableFileLanguage;
      title?: string;
      prompt: string;
      hint?: string;
      solution: string;
    }
  | {
      type: "decisionTable";
      title?: string;
      columns: string[];
      rows: { label: string; cells: string[] }[];
    }
  | { type: "lab"; labId: string };

export interface DocsLesson {
  slug: string[];
  title: string;
  description: string;
  section: string;
  order: number;
  concepts: KubernetesConcept[];
  relatedLevelSlug?: string;
  sources?: { title: string; href: string }[];
  content: DocsBlock[];
  labs: InteractiveLab[];
}
