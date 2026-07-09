import { z } from "zod";

/**
 * Local progress persistence (localStorage). No account required — progress lives in
 * the browser. Writes are throttled to avoid thrashing during rapid updates. SSR-safe:
 * all access is guarded so it is inert on the server.
 */

const STORAGE_KEY = "klab:progress:v1";

const progressSchema = z.object({
  version: z.literal(1),
  xp: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  solvedLevelSlugs: z.array(z.string()),
  /** XP penalty already spent per level (from revealed hints), keyed by slug. */
  hintPenalties: z.record(z.string(), z.number()),
});

export type Progress = z.infer<typeof progressSchema>;

export const EMPTY_PROGRESS: Progress = {
  version: 1,
  xp: 0,
  streakDays: 0,
  solvedLevelSlugs: [],
  hintPenalties: {},
};

export function loadProgress(): Progress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Dispatched on the window after progress is persisted, so live UI (nav, /progress) can refresh. */
export const PROGRESS_EVENT = "klab:progress-changed";

let pendingWrite: ReturnType<typeof setTimeout> | null = null;
let pendingValue: Progress | null = null;

/** Persist progress, throttled to at most once per `delayMs`. */
export function saveProgress(progress: Progress, delayMs = 400): void {
  if (typeof window === "undefined") return;
  pendingValue = progress;
  if (pendingWrite) return;
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    if (pendingValue) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingValue));
        window.dispatchEvent(new Event(PROGRESS_EVENT));
      } catch {
        // Storage full or unavailable — progress is best-effort, so ignore.
      }
    }
  }, delayMs);
}

/** Record a solved level and award XP (net of hint penalties already spent). */
export function recordSolved(progress: Progress, slug: string, levelXp: number): Progress {
  if (progress.solvedLevelSlugs.includes(slug)) return progress;
  const penalty = progress.hintPenalties[slug] ?? 0;
  const awarded = Math.max(0, levelXp - penalty);
  return {
    ...progress,
    xp: progress.xp + awarded,
    solvedLevelSlugs: [...progress.solvedLevelSlugs, slug],
  };
}

export function recordHintPenalty(progress: Progress, slug: string, penalty: number): Progress {
  return {
    ...progress,
    hintPenalties: {
      ...progress.hintPenalties,
      [slug]: (progress.hintPenalties[slug] ?? 0) + penalty,
    },
  };
}
