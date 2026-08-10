import { z } from "zod";

/**
 * Local progress persistence (localStorage). No account required — progress lives in
 * the browser. Writes are throttled to avoid thrashing during rapid updates. SSR-safe:
 * all access is guarded so it is inert on the server.
 */

const STORAGE_KEY = "klab:progress:v1";

/** Base localStorage key. The store derives identity-scoped keys (`…:u:<id>`) from it. */
export const PROGRESS_STORAGE_KEY = STORAGE_KEY;

export const progressSchema = z.object({
  version: z.literal(1),
  xp: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  solvedLevelSlugs: z.array(z.string()),
  /** Grow-only hint facts keyed by level slug and hint id; penalties derive from these facts. */
  hintReveals: z.record(z.string(), z.record(z.string(), z.number())).default({}),
  // Later additions use .default() so progress blobs written before them still parse.
  /** Levels the user has started investigating (first command/apply), solved or not. */
  attemptedLevelSlugs: z.array(z.string()).default([]),
  /** Bookmarked problems (the catalog's "Saved" tab). */
  savedProblemSlugs: z.array(z.string()).default([]),
  /** Docs lessons the user has marked complete, keyed by joined slug (e.g. "networking/services"). */
  completedLessonSlugs: z.array(z.string()).default([]),
  /** Local calendar day (YYYY-MM-DD) of the most recent solve, for the day streak. */
  lastSolvedDay: z.string().optional(),
});

export type Progress = z.infer<typeof progressSchema>;

export const EMPTY_PROGRESS: Progress = {
  version: 1,
  xp: 0,
  streakDays: 0,
  solvedLevelSlugs: [],
  hintReveals: {},
  attemptedLevelSlugs: [],
  savedProblemSlugs: [],
  completedLessonSlugs: [],
};

/** Read + validate the Progress blob at a specific localStorage key (identity-scoped). */
export function readProgressAt(key: string): Progress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function loadProgress(): Progress {
  return readProgressAt(STORAGE_KEY);
}

/** Validate an already-parsed value (e.g. a server JSON response) into a Progress. */
export function coerceProgress(value: unknown): Progress {
  const parsed = progressSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_PROGRESS;
}

/** Strict validation for remote snapshots. Unlike `coerceProgress`, invalid data throws. */
export function parseProgress(value: unknown): Progress {
  return progressSchema.parse(value);
}

/** Dispatched on the window after progress is persisted, so live UI (nav, /progress) can refresh. */
export const PROGRESS_EVENT = "klab:progress-changed";

let pendingWrite: ReturnType<typeof setTimeout> | null = null;
let pendingValue: Progress | null = null;
let pendingKey: string | null = null;

/**
 * Persist progress to a specific key. `delayMs <= 0` writes synchronously so the very
 * next `readProgressAt` sees it — this keeps localStorage the single source of truth,
 * lets rapid sequential mutations compose without lost updates, and makes the live UI
 * update immediately. `delayMs > 0` keeps the trailing-edge throttle for chatty writes.
 */
export function writeProgressAt(key: string, progress: Progress, delayMs = 400): void {
  if (typeof window === "undefined") return;
  if (delayMs <= 0) {
    try {
      window.localStorage.setItem(key, JSON.stringify(progress));
      window.dispatchEvent(new Event(PROGRESS_EVENT));
    } catch {
      // Storage full or unavailable — progress is best-effort, so ignore.
    }
    return;
  }
  pendingValue = progress;
  pendingKey = key;
  if (pendingWrite) return;
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    if (pendingValue && pendingKey) {
      try {
        window.localStorage.setItem(pendingKey, JSON.stringify(pendingValue));
        window.dispatchEvent(new Event(PROGRESS_EVENT));
      } catch {
        // Storage full or unavailable — progress is best-effort, so ignore.
      }
    }
  }, delayMs);
}

/** Persist progress to the guest key, throttled to at most once per `delayMs`. */
export function saveProgress(progress: Progress, delayMs = 400): void {
  writeProgressAt(STORAGE_KEY, progress, delayMs);
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
export function recordSolved(
  progress: Progress,
  slug: string,
  levelXp: number,
  solvedDay = localDay(),
): Progress {
  if (progress.solvedLevelSlugs.includes(slug)) return progress;
  const penalty = hintPenaltyFor(progress, slug);
  const awarded = Math.max(0, levelXp - penalty);
  const streakDays =
    progress.lastSolvedDay === solvedDay
      ? progress.streakDays
      : progress.lastSolvedDay === previousDay(solvedDay)
        ? progress.streakDays + 1
        : 1;
  return {
    ...progress,
    xp: progress.xp + awarded,
    solvedLevelSlugs: [...progress.solvedLevelSlugs, slug],
    streakDays,
    lastSolvedDay: solvedDay,
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalDay(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
}

/**
 * Canonical guest facts used for merge idempotency. Derived totals and client-provided
 * penalties are deliberately excluded: the server reconstructs those from its catalog.
 */
export function canonicalProgressFacts(progress: Progress): string {
  const hints = Object.entries(progress.hintReveals)
    .flatMap(([slug, reveals]) => Object.keys(reveals).map((hintId) => [slug, hintId] as const))
    .sort(([slugA, hintA], [slugB, hintB]) =>
      slugA === slugB ? compareText(hintA, hintB) : compareText(slugA, slugB),
    );

  return JSON.stringify({
    solved: uniqueSorted(progress.solvedLevelSlugs),
    attempted: uniqueSorted(progress.attemptedLevelSlugs),
    saved: uniqueSorted(progress.savedProblemSlugs),
    completedLessons: uniqueSorted(progress.completedLessonSlugs),
    hints,
    lastSolvedDay: canonicalDay(progress.lastSolvedDay),
  });
}

/** Stable SHA-256 merge fingerprint, with a deterministic fallback for older runtimes. */
export async function progressFingerprint(progress: Progress): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalProgressFacts(progress));
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
    return `v1:${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  // FNV-1a 64-bit is not a security primitive; it is only an old-runtime idempotency key.
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `v1-fallback:${hash.toString(16).padStart(16, "0")}`;
}

/** Mark a level as attempted (first investigation action). Idempotent. */
export function recordAttempted(progress: Progress, slug: string): Progress {
  if (progress.attemptedLevelSlugs.includes(slug)) return progress;
  return { ...progress, attemptedLevelSlugs: [...progress.attemptedLevelSlugs, slug] };
}

/** Mark a docs lesson complete (grow-only, keyed by joined slug). Idempotent. */
export function recordLessonCompleted(progress: Progress, slug: string): Progress {
  if (progress.completedLessonSlugs.includes(slug)) return progress;
  return { ...progress, completedLessonSlugs: [...progress.completedLessonSlugs, slug] };
}

/** Toggle a problem bookmark (the catalog's "Saved" tab). */
export function toggleSaved(progress: Progress, slug: string): Progress {
  const saved = progress.savedProblemSlugs.includes(slug)
    ? progress.savedProblemSlugs.filter((s) => s !== slug)
    : [...progress.savedProblemSlugs, slug];
  return { ...progress, savedProblemSlugs: saved };
}

export function hintPenaltyFor(progress: Progress, slug: string): number {
  return Object.values(progress.hintReveals[slug] ?? {}).reduce((sum, penalty) => sum + penalty, 0);
}

export function recordHintPenalty(
  progress: Progress,
  slug: string,
  hintId: string,
  penalty: number,
): Progress {
  const current = progress.hintReveals[slug] ?? {};
  if (Object.hasOwn(current, hintId)) return progress;
  return {
    ...progress,
    hintReveals: {
      ...progress.hintReveals,
      [slug]: { ...current, [hintId]: penalty },
    },
  };
}
