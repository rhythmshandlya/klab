import { z } from "zod";

import type { DocsLesson, PlaygroundTemplate, ProblemLevel } from "./types";

/**
 * Zod schemas mirroring `./types.ts`. Static content is parsed through these so the
 * runtime can trust it. `z.infer` of each schema is checked to equal the hand-written
 * domain type via the `satisfies` assertions at the bottom, keeping the two in sync.
 */

export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const conceptSchema = z.enum([
  "pods",
  "deployments",
  "replicasets",
  "services",
  "endpoints",
  "endpointslices",
  "labels-selectors",
  "readiness-probes",
  "liveness-probes",
  "dns",
  "namespaces",
  "rollouts",
  "events",
  "reconciliation",
  "networking",
  "debugging",
]);

const fileLanguageSchema = z.enum(["yaml", "json", "typescript", "markdown"]);

export const editableFileSchema = z.object({
  path: z.string().min(1),
  language: fileLanguageSchema,
  initialValue: z.string(),
});

export const readonlyFileSchema = z.object({
  path: z.string().min(1),
  language: fileLanguageSchema,
  value: z.string(),
});

const constraintSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const evidenceSourceSchema = z.enum([
  "terminal",
  "events",
  "network",
  "topology",
  "object-explorer",
  "validator",
]);

const evidenceTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    commandMatches: z.string().min(1),
    outputMatches: z.string().optional(),
  }),
  z.object({
    type: z.literal("probe"),
    pathMatches: z.string().min(1),
    status: z.number().int(),
  }),
  z.object({
    type: z.literal("event-reason"),
    reason: z.string().min(1),
  }),
]);

const evidenceRuleSchema = z.object({
  id: z.string().min(1),
  evidenceId: z.string().min(1),
  label: z.string().min(1),
  source: evidenceSourceSchema,
  trigger: evidenceTriggerSchema,
});

const hintSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  xpPenalty: z.number().int().nonnegative(),
  unlockAfter: z.array(z.string()).optional(),
});

const simulatedImageSchema = z.object({
  ref: z.string().min(1),
  description: z.string().min(1),
});

const validatorCheckSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("deployment-ready"),
    namespace: z.string().min(1),
    name: z.string().min(1),
    minReadyReplicas: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("service-has-ready-endpoints"),
    namespace: z.string().min(1),
    name: z.string().min(1),
    minReadyEndpoints: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("http-get-through-service"),
    namespace: z.string().min(1),
    service: z.string().min(1),
    port: z.number().int().positive(),
    path: z.string().min(1),
    expectStatus: z.number().int(),
  }),
  z.object({
    kind: z.literal("no-recent-readiness-failures"),
    namespace: z.string().min(1),
    withinSeconds: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("pod-ready-by-selector"),
    namespace: z.string().min(1),
    selector: z.record(z.string(), z.string()),
    minReady: z.number().int().nonnegative(),
  }),
]);

const validatorSharedSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  successLabel: z.string().min(1),
  failureLabel: z.string().min(1),
});

const levelValidatorSchema = z.intersection(validatorSharedSchema, validatorCheckSchema);

const postSolveSchema = z.object({
  rootCause: z.string().min(1),
  whyItFailed: z.string().min(1),
  whatFixedIt: z.string().min(1),
  relatedConcepts: z.array(conceptSchema),
  docsHref: z.string().optional(),
});

export const problemLevelSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  difficulty: difficultySchema,
  severity: severitySchema,
  xp: z.number().int().positive(),
  concepts: z.array(conceptSchema).min(1),
  story: z.string().min(1),
  objective: z.string().min(1),
  constraints: z.array(constraintSchema),
  files: z.array(editableFileSchema).min(1),
  readonlyFiles: z.array(readonlyFileSchema),
  initialManifests: z.array(z.string()),
  registeredImages: z.array(simulatedImageSchema),
  allowedCommands: z.array(z.string()),
  validators: z.array(levelValidatorSchema).min(1),
  hints: z.array(hintSchema),
  evidenceRules: z.array(evidenceRuleSchema),
  postSolveExplanation: postSolveSchema,
});

const interactiveLabSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  files: z.array(editableFileSchema),
  initialManifests: z.array(z.string()),
  registeredImages: z.array(simulatedImageSchema),
  tryChanging: z.string().optional(),
});

export const playgroundTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  concepts: z.array(conceptSchema),
  files: z.array(editableFileSchema),
  initialManifests: z.array(z.string()),
  registeredImages: z.array(simulatedImageSchema),
});

export const docsLessonSchema = z.object({
  slug: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  order: z.number().int().nonnegative(),
  concepts: z.array(conceptSchema),
  relatedLevelSlug: z.string().optional(),
  labs: z.array(interactiveLabSchema),
});

/**
 * Parse-or-throw helpers. The domain-type return annotations double as a
 * compile-time guarantee that each schema's inferred output stays assignable to the
 * hand-written type in `./types.ts` — if they drift, this file fails to typecheck.
 */
export function parseLevel(input: unknown): ProblemLevel {
  return problemLevelSchema.parse(input);
}
export function parseTemplate(input: unknown): PlaygroundTemplate {
  return playgroundTemplateSchema.parse(input);
}
export function parseLesson(input: unknown): DocsLesson {
  return docsLessonSchema.parse(input);
}
