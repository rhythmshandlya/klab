import {
  coerceProgress,
  PROGRESS_EVENT,
  PROGRESS_STORAGE_KEY,
  readProgressAt,
  writeProgressAt,
  type Progress,
} from "./local-progress";
import { applyIntent, type ProgressIntent } from "./progress-intent";

/**
 * Identity-aware progress store — the seam between the UI and either localStorage
 * (guests) or the server (signed-in). Design: local-first, intent-synced,
 * server-derived.
 *
 *  - Guests (identity = null): reads/writes the guest key exactly as before. No network.
 *  - Signed in: reads/writes an identity-scoped key, and every mutation is ALSO queued
 *    as an idempotent intent and pushed to /api/progress in the background. On sign-in
 *    the guest progress is merged into the account (once) and the authoritative server
 *    snapshot is pulled.
 *
 * Reads stay behind the existing `PROGRESS_EVENT` bus, so `useProgress` refreshes
 * through the mechanism it already uses. The durable outbox lives in localStorage
 * (small, synchronous, testable) rather than IndexedDB.
 */

const QUEUE_KEY = "klab:sync-queue:v1";
const MERGE_MARKER_KEY = "klab:merged:v1";

let identity: string | null = null;

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function keyFor(id: string | null): string {
  return id ? `${PROGRESS_STORAGE_KEY}:u:${id}` : PROGRESS_STORAGE_KEY;
}

/** The current identity's Progress snapshot (guest key when signed out). */
export function getProgress(): Progress {
  return readProgressAt(keyFor(identity));
}

/** Current signed-in user id, or null for a guest. */
export function getIdentity(): string | null {
  return identity;
}

/**
 * Apply a mutation optimistically to the local cache (instant UI via PROGRESS_EVENT)
 * and, when signed in, queue it for background sync. `delayMs = 0` so sequential
 * mutations compose off fresh state.
 */
export function mutateProgress(intent: ProgressIntent): void {
  const next = applyIntent(getProgress(), intent);
  writeProgressAt(keyFor(identity), next, 0);
  if (identity) {
    enqueue(intent);
    scheduleFlush();
  }
}

// --- outbox --------------------------------------------------------------

function readQueue(): ProgressIntent[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressIntent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: ProgressIntent[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort
  }
}

function enqueue(intent: ProgressIntent): void {
  const queue = readQueue();
  queue.push(intent);
  writeQueue(queue);
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush(delayMs = 600): void {
  if (!hasWindow() || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delayMs);
}

/** Push queued intents to the server, then adopt the authoritative snapshot. */
export async function flush(): Promise<void> {
  if (flushing || !identity || !hasWindow()) return;
  const batch = readQueue();
  if (batch.length === 0) return;
  flushing = true;
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intents: batch }),
      keepalive: true,
    });
    if (res.ok) {
      const snapshot = coerceProgress(await res.json());
      // Drop the flushed batch; re-apply anything queued during the round-trip on top
      // of the server truth so no optimistic mutation is lost.
      const remaining = readQueue().slice(batch.length);
      writeQueue(remaining);
      const merged = remaining.reduce(applyIntent, snapshot);
      writeProgressAt(keyFor(identity), merged, 0);
      if (remaining.length > 0) scheduleFlush();
    }
    // Non-OK (e.g. 401/501/network): leave the queue for a later retry.
  } catch {
    // Offline — keep the queue; a later flush (focus/online) retries.
  } finally {
    flushing = false;
  }
}

/** Pull the authoritative server snapshot and adopt it (re-applying any queued intents). */
export async function pullRemote(): Promise<void> {
  if (!identity || !hasWindow()) return;
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const snapshot = coerceProgress(await res.json());
    const merged = readQueue().reduce(applyIntent, snapshot);
    writeProgressAt(keyFor(identity), merged, 0);
  } catch {
    // ignore — local cache stays authoritative offline
  }
}

/**
 * Switch the active identity (called by the session bridge). On the guest→user
 * transition, merge the guest's local progress into the account once, then pull the
 * server snapshot. Emits PROGRESS_EVENT so `useProgress` re-reads the new cache.
 */
export async function setIdentity(id: string | null): Promise<void> {
  if (id === identity) return;
  if (identity) await flush(); // drain the previous identity's outbox
  identity = id;
  if (hasWindow()) window.dispatchEvent(new Event(PROGRESS_EVENT));
  if (id) {
    await maybeMerge(id);
    await pullRemote();
  }
}

/** One-shot guest→account merge, guarded by a per-user marker so it can't double-count. */
async function maybeMerge(userId: string): Promise<void> {
  if (!hasWindow()) return;
  try {
    if (window.localStorage.getItem(MERGE_MARKER_KEY) === userId) return;
    const guest = readProgressAt(PROGRESS_STORAGE_KEY);
    const res = await fetch("/api/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ progress: guest }),
    });
    if (res.ok) window.localStorage.setItem(MERGE_MARKER_KEY, userId);
  } catch {
    // merge is retried on the next sign-in until the marker is set
  }
}

/** Reset in-memory store state (identity, outbox, timers). For tests and hard sign-out. */
export function resetProgressStore(): void {
  identity = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushing = false;
  writeQueue([]);
}

/** Register flush triggers (focus/online/pagehide). Idempotent; safe to call once on mount. */
let listenersBound = false;
export function bindSyncListeners(): void {
  if (!hasWindow() || listenersBound) return;
  listenersBound = true;
  const onWake = () => {
    if (identity) {
      void flush();
      void pullRemote();
    }
  };
  window.addEventListener("online", () => void flush());
  window.addEventListener("focus", onWake);
  window.addEventListener("pagehide", () => void flush());
}
