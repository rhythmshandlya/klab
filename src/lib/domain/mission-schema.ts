import { z } from "zod";
import type { Mission } from "./mission-types";

const quizOption = z.object({
  id: z.string(),
  text: z.string().min(1),
  correct: z.boolean(),
  explain: z.string().min(1),
});
const quiz = z.object({ question: z.string().min(1), options: z.array(quizOption).min(2) });
const editableFile = z.object({
  path: z.string(),
  initialValue: z.string(),
  language: z.enum(["yaml", "json", "typescript", "markdown"]),
});
const conceptDiagramVariant = z.enum([
  "control-loop",
  "cluster-architecture",
  "api-object",
  "workload-hierarchy",
  "service-routing",
]);
const diagramSpec = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("live") }),
  z.object({
    mode: z.literal("concept"),
    variant: conceptDiagramVariant,
    buildToStep: z.number().int(),
  }),
  z.object({ mode: z.literal("static"), variant: conceptDiagramVariant }),
]);
const doCheck = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pods-ready"),
    selector: z.record(z.string(), z.string()),
    minReady: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("deployment-available"),
    name: z.string(),
    minAvailable: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("deployment-replicas"),
    name: z.string(),
    replicas: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("service-has-endpoints"),
    name: z.string(),
    minEndpoints: z.number().int().positive(),
  }),
]);
const step = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("teach"),
    id: z.string(),
    idea: z.string().min(1),
    visual: diagramSpec.optional(),
    ack: z.string().optional(),
  }),
  z.object({
    kind: z.literal("predict"),
    id: z.string(),
    predict: z.object({
      question: z.string().min(1),
      options: z.array(quizOption).min(2),
      reveal: z.string().min(1),
    }),
    visual: diagramSpec.optional(),
  }),
  z.object({ kind: z.literal("check"), id: z.string(), quiz }),
  z.object({
    kind: z.literal("do"),
    id: z.string(),
    goal: z.string().min(1),
    files: z.array(editableFile).min(1),
    check: doCheck,
    hint: z.string().optional(),
    debrief: z.string().min(1),
  }),
  z.object({
    kind: z.literal("debrief"),
    id: z.string(),
    summary: z.string().min(1),
    commands: z.array(z.string()).optional(),
    takeaways: z.array(z.string()).min(1),
  }),
]);

export const missionSchema = z.object({
  slug: z.array(z.string()).min(1),
  section: z.string().min(1),
  order: z.number().int(),
  title: z.string().min(1),
  coldOpen: z.object({ goal: z.string().min(1), clusterNote: z.string().min(1) }),
  steps: z.array(step).min(1),
  inheritsCluster: z.boolean(),
  seedManifests: z.array(z.string()).optional(),
  concepts: z.array(z.string()),
});

export function parseMission(input: unknown): Mission {
  return missionSchema.parse(input) as Mission;
}

export function assertMissionInvariants(m: Mission): void {
  const ids = new Set<string>();
  for (const s of m.steps) {
    if (ids.has(s.id))
      throw new Error(`Mission ${m.slug.join("/")}: step ids must be unique (${s.id})`);
    ids.add(s.id);
    if (s.kind === "check") {
      const correct = s.quiz.options.filter((o) => o.correct).length;
      if (correct !== 1)
        throw new Error(
          `Mission ${m.slug.join("/")} step ${s.id}: quiz must have exactly one correct option`,
        );
    }
    if (s.kind === "predict") {
      const correct = s.predict.options.filter((o) => o.correct).length;
      if (correct !== 1)
        throw new Error(
          `Mission ${m.slug.join("/")} step ${s.id}: predict must have exactly one correct option`,
        );
    }
  }
  if (!m.inheritsCluster && !m.seedManifests) {
    throw new Error(
      `Mission ${m.slug.join("/")}: a non-inheriting mission must define seedManifests`,
    );
  }
}
