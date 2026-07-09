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
  // Later additions use .default() so progress blobs written before them still parse.
  /** Levels the user has started investigating (first command/apply), solved or not. */
  attemptedLevelSlugs: z.array(z.string()).default([]),
  /** Bookmarked problems (the catalog's "Saved" tab). */
  savedProblemSlugs: z.array(z.string()).default([]),
  /** Local calendar day (YYYY-MM-DD) of the most recent solve, for the day streak. */
  lastSolvedDay: z.string().optional(),
});

export type Progress = z.infer<typeof progressSchema>;

export const EMPTY_PROGRESS: Progress = {
  version: 1,
  xp: 0,
  streakDays: 0,
  solvedLevelSlugs: [],
  hintPenalties: {},
  attemptedLevelSlugs: [],
  savedProblemSlugs: [],
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

/** Local calendar day as YYYY-MM-DD (streaks are per local day, not UTC). */
function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1));
}

/** Record a solved level, award XP (net of hint penalties), and advance the day streak. */
export function recordSolved(progress: Progress, slug: string, levelXp: number): Progress {
  if (progress.solvedLevelSlugs.includes(slug)) return progress;
  const penalty = progress.hintPenalties[slug] ?? 0;
  const awarded = Math.max(0, levelXp - penalty);
  const today = localDay();
  const streakDays =
    progress.lastSolvedDay === today
      ? progress.streakDays
      : progress.lastSolvedDay === previousDay(today)
        ? progress.streakDays + 1
        : 1;
  return {
    ...progress,
    xp: progress.xp + awarded,
    solvedLevelSlugs: [...progress.solvedLevelSlugs, slug],
    streakDays,
    lastSolvedDay: today,
  };
}

/** Mark a level as attempted (first investigation action). Idempotent. */
export function recordAttempted(progress: Progress, slug: string): Progress {
  if (progress.attemptedLevelSlugs.includes(slug)) return progress;
  return { ...progress, attemptedLevelSlugs: [...progress.attemptedLevelSlugs, slug] };
}

/** Toggle a problem bookmark (the catalog's "Saved" tab). */
export function toggleSaved(progress: Progress, slug: string): Progress {
  const saved = progress.savedProblemSlugs.includes(slug)
    ? progress.savedProblemSlugs.filter((s) => s !== slug)
    : [...progress.savedProblemSlugs, slug];
  return { ...progress, savedProblemSlugs: saved };
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
