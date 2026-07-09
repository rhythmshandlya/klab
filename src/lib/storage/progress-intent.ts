import { z } from "zod";

import { assertNever } from "@/lib/utils/exhaustive";

import { recordAttempted, recordHintPenalty, recordSolved, type Progress } from "./local-progress";

/**
 * A progress mutation expressed as a named, idempotent INTENT rather than a whole-blob
 * write. This is the wire format between client and server: the client applies an
 * intent optimistically to its local cache (via `applyIntent`, which reuses the
 * existing pure reducers so guest behavior is unchanged) AND pushes it to the server,
 * where each intent lowers to an idempotent keyed upsert. XP/streak/penalty are never
 * transmitted as totals — they are derived on each side from grow-only facts.
 *
 * `solved.xp` is the level's GROSS xp; both sides net out the hint penalty (the client
 * inside `recordSolved`, the server against its `hint_reveals` rows), so the totals agree.
 */
export type ProgressIntent =
  | { kind: "solved"; slug: string; xp: number; day: string }
  | { kind: "attempted"; slug: string }
  | { kind: "setSaved"; slug: string; saved: boolean }
  | { kind: "revealHint"; slug: string; hintId: string; penalty: number }
  | {
      kind: "submission";
      slug: string;
      passed: boolean;
      checksTotal: number;
      checksPassed: number;
      durationMs?: number;
      hintsRevealed?: number;
      results?: unknown;
      clientMutationId?: string;
    };

export const progressIntentSchema: z.ZodType<ProgressIntent> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solved"), slug: z.string().min(1), xp: z.number().int(), day: z.string().min(1) }),
  z.object({ kind: z.literal("attempted"), slug: z.string().min(1) }),
  z.object({ kind: z.literal("setSaved"), slug: z.string().min(1), saved: z.boolean() }),
  z.object({
    kind: z.literal("revealHint"),
    slug: z.string().min(1),
    hintId: z.string().min(1),
    penalty: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("submission"),
    slug: z.string().min(1),
    passed: z.boolean(),
    checksTotal: z.number().int().nonnegative(),
    checksPassed: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().optional(),
    hintsRevealed: z.number().int().nonnegative().optional(),
    results: z.unknown().optional(),
    clientMutationId: z.string().min(1).optional(),
  }),
]);

/** Validate a POST body `{ intents: [...] }` into a typed intent list. */
export function parseIntents(body: unknown): ProgressIntent[] {
  const parsed = z.object({ intents: z.array(progressIntentSchema).max(500) }).safeParse(body);
  return parsed.success ? parsed.data.intents : [];
}

/**
 * Apply an intent to a local Progress snapshot, reusing the existing pure reducers so
 * the optimistic client path stays behaviorally identical to today. `submission` is
 * history-only and doesn't change the Progress blob.
 */
export function applyIntent(progress: Progress, intent: ProgressIntent): Progress {
  switch (intent.kind) {
    case "solved":
      return recordSolved(progress, intent.slug, intent.xp);
    case "attempted":
      return recordAttempted(progress, intent.slug);
    case "setSaved": {
      const has = progress.savedProblemSlugs.includes(intent.slug);
      if (intent.saved === has) return progress;
      return {
        ...progress,
        savedProblemSlugs: intent.saved
          ? [...progress.savedProblemSlugs, intent.slug]
          : progress.savedProblemSlugs.filter((s) => s !== intent.slug),
      };
    }
    case "revealHint":
      return recordHintPenalty(progress, intent.slug, intent.penalty);
    case "submission":
      return progress;
    default:
      return assertNever(intent);
  }
}

export function applyIntents(progress: Progress, intents: readonly ProgressIntent[]): Progress {
  return intents.reduce(applyIntent, progress);
}
