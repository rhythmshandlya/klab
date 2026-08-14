import { z } from "zod";

/**
 * Per-level workspace persistence. A learner's editor contents are the work: an
 * architecture build asks for hundreds of lines across a dozen files, and losing that
 * to a refresh or an accidental navigation is the most expensive bug the workspace can
 * have. Revealed hints and collected evidence ride along so a reload cannot re-charge
 * XP for a hint already paid for, or silently re-lock a hint tier.
 *
 * Guest-safe and best effort: SSR-guarded, quota failures are swallowed, and anything
 * that fails validation is treated as absent rather than crashing the workspace.
 */

const KEY_PREFIX = "klab:level-workspace:v2:";

/** Keep recent levels only, so a long-running browser profile cannot fill its quota. */
const MAX_STORED_LEVELS = 40;

const snapshotSchema = z.object({
  slug: z.string().min(1),
  contentVersion: z.number().int().positive(),
  files: z.record(z.string(), z.string()),
  activeFilePath: z.string(),
  revealedHintIds: z.array(z.string()),
  collectedEvidence: z.array(z.string()),
  updatedAt: z.number(),
});

export type LevelWorkspaceSnapshot = z.infer<typeof snapshotSchema>;

function keyFor(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export function readLevelWorkspace(
  slug: string,
  contentVersion: number,
): LevelWorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    return parsed.success &&
      parsed.data.slug === slug &&
      parsed.data.contentVersion === contentVersion
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function clearLevelWorkspace(slug: string): void {
  cancelPendingWrite(slug);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(slug));
  } catch {
    // ignore
  }
}

function writeNow(snapshot: LevelWorkspaceSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(snapshot.slug), JSON.stringify(snapshot));
    pruneOldest();
  } catch {
    // Quota exceeded or storage disabled: the workspace still works in memory.
  }
}

function pruneOldest(): void {
  try {
    const entries: { key: string; updatedAt: number }[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? snapshotSchema.safeParse(JSON.parse(raw)) : null;
      entries.push({ key, updatedAt: parsed?.success ? parsed.data.updatedAt : 0 });
    }
    if (entries.length <= MAX_STORED_LEVELS) return;
    entries
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, entries.length - MAX_STORED_LEVELS)
      .forEach((entry) => window.localStorage.removeItem(entry.key));
  } catch {
    // ignore
  }
}

/**
 * Editor changes arrive on every keystroke. Coalesce them so typing never blocks on
 * JSON serialization, and flush on unmount so the last keystroke is never lost.
 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const queued = new Map<string, LevelWorkspaceSnapshot>();
const WRITE_DELAY_MS = 400;

export function saveLevelWorkspace(snapshot: Omit<LevelWorkspaceSnapshot, "updatedAt">): void {
  if (typeof window === "undefined") return;
  const next: LevelWorkspaceSnapshot = { ...snapshot, updatedAt: Date.now() };
  queued.set(next.slug, next);
  const existing = pending.get(next.slug);
  if (existing) clearTimeout(existing);
  pending.set(
    next.slug,
    setTimeout(() => flushLevelWorkspace(next.slug), WRITE_DELAY_MS),
  );
}

export function flushLevelWorkspace(slug: string): void {
  const timer = pending.get(slug);
  if (timer) clearTimeout(timer);
  pending.delete(slug);
  const snapshot = queued.get(slug);
  if (!snapshot) return;
  queued.delete(slug);
  writeNow(snapshot);
}

function cancelPendingWrite(slug: string): void {
  const timer = pending.get(slug);
  if (timer) clearTimeout(timer);
  pending.delete(slug);
  queued.delete(slug);
}
