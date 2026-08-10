import type { EditableFile } from "./types";

/** A React-Flow-backed teaching diagram. */
export type DiagramSpec =
  | { mode: "live" } // renders the section's current cluster via ServiceTopology
  | { mode: "concept"; variant: ConceptDiagramVariant; buildToStep: number }
  | { mode: "static"; variant: ConceptDiagramVariant };

export type ConceptDiagramVariant =
  "control-loop" | "cluster-architecture" | "api-object" | "workload-hierarchy" | "service-routing";

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
  explain: string;
}

export interface QuizSpec {
  question: string;
  options: QuizOption[];
}

export interface PredictSpec {
  question: string;
  options: QuizOption[];
  reveal: string;
}

/** A check evaluated against the live cluster snapshot after the learner applies. */
export type DoCheck =
  | { kind: "pods-ready"; selector: Record<string, string>; minReady: number }
  | { kind: "deployment-available"; name: string; minAvailable: number }
  /**
   * Exact desired-replica match: passes only when spec.replicas === replicas AND that
   * many are ready. Min-only checks cannot gate a downscale (the pre-edit state already
   * satisfies them); use this whenever the taught action is scaling DOWN.
   */
  | { kind: "deployment-replicas"; name: string; replicas: number }
  | { kind: "service-has-endpoints"; name: string; minEndpoints: number };

export type MissionStep =
  | { kind: "teach"; id: string; idea: string; visual?: DiagramSpec; ack?: string }
  | { kind: "predict"; id: string; predict: PredictSpec; visual?: DiagramSpec }
  | { kind: "check"; id: string; quiz: QuizSpec }
  | {
      kind: "do";
      id: string;
      goal: string;
      files: EditableFile[];
      check: DoCheck;
      hint?: string;
      debrief: string;
    }
  | { kind: "debrief"; id: string; summary: string; commands?: string[]; takeaways: string[] };

export interface Mission {
  slug: string[]; // e.g. ["foundations", "what-is-kubernetes"]
  section: string; // "Foundations"
  order: number;
  title: string;
  coldOpen: { goal: string; clusterNote: string };
  steps: MissionStep[];
  /** false for the first mission of a section; true means inherit the prior mission's cluster. */
  inheritsCluster: boolean;
  /** Manifests applied when the mission does NOT inherit (fresh section start). */
  seedManifests?: string[];
  concepts: string[];
}
