import {
  EMPTY_PROGRESS,
  parseProgress,
  PROGRESS_EVENT,
  PROGRESS_STORAGE_KEY,
  type Progress,
} from "./local-progress";
import {
  applyIntent,
  createClientMutationId,
  parseMergeResponse,
  parseProgressSyncResponse,
  PROGRESS_OWNER_HEADER,
  progressDeliverySchema,
  type ProgressDelivery,
  type ProgressIntent,
} from "./progress-intent";

/**
 * Identity-safe progress ledger. The public interface stays deliberately small while
 * this implementation owns the difficult details: durable delivery records, actor
 * capture, cross-tab serialization, exact acknowledgements, retries, and guest merge.
 */

const LEGACY_QUEUE_KEY = "klab:sync-queue:v1";
const LEGACY_QUARANTINE_KEY = "klab:sync-quarantine:v1:ownerless";
const OUTBOX_PREFIX = "klab:sync-outbox:v2";
const CORRUPT_PREFIX = "klab:sync-quarantine:v2";
const MERGE_MARKER_PREFIX = "klab:merged:v2";
const MAX_BATCH_SIZE = 200;
const MAX_BATCHES_PER_FLUSH = 10;
const INITIAL_FLUSH_DELAY_MS = 0;
const MAX_RETRY_DELAY_MS = 30_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type TimerHandle = ReturnType<typeof setTimeout>;

export interface ProgressStoreDependencies {
  storage?: Storage | null;
  events?: EventTarget | null;
  request?: FetchLike;
  createId?: () => string;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  withLock?: (name: string, task: () => Promise<void>) => Promise<void>;
}

export interface ProgressStore {
  getProgress(): Progress;
  getIdentity(): string | null;
  mutateProgress(intent: ProgressIntent): void;
  flush(): Promise<void>;
  pullRemote(): Promise<void>;
  setIdentity(id: string | null): Promise<void>;
  bindSyncListeners(): () => void;
  hasPending(ownerId: string): boolean;
  clearIdentityData(ownerId: string): void;
  reset(): void;
}

function ownerToken(ownerId: string): string {
  return encodeURIComponent(ownerId);
}

function cacheKeyFor(ownerId: string | null): string {
  return ownerId ? `${PROGRESS_STORAGE_KEY}:u:${ownerId}` : PROGRESS_STORAGE_KEY;
}

function outboxPrefixFor(ownerId: string): string {
  return `${OUTBOX_PREFIX}:u:${ownerToken(ownerId)}:e:`;
}

function outboxKeyFor(ownerId: string, deliveryId: string): string {
  return `${outboxPrefixFor(ownerId)}${encodeURIComponent(deliveryId)}`;
}

function mergeMarkerKeyFor(ownerId: string): string {
  return `${MERGE_MARKER_PREFIX}:u:${ownerToken(ownerId)}`;
}

export function createProgressStore(dependencies: ProgressStoreDependencies = {}): ProgressStore {
  let identity: string | null = null;
  let runtimeEpoch = 0;
  let legacyChecked = false;
  let disposeListeners: (() => void) | null = null;

  const timers = new Map<string, TimerHandle>();
  const retryAttempts = new Map<string, number>();
  const operationTails = new Map<string, Promise<void>>();
  const flushes = new Map<string, Promise<void>>();
  const pulls = new Map<string, Promise<void>>();
  const merges = new Map<string, Promise<void>>();
  /** Signed-in data is memory-only; Postgres is authoritative once an account exists. */
  const memoryCaches = new Map<string, Progress>();
  const memoryOutboxes = new Map<string, ProgressDelivery[]>();

  const getStorage = (): Storage | null => {
    if (dependencies.storage !== undefined) return dependencies.storage;
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  const getEvents = (): EventTarget | null => {
    if (dependencies.events !== undefined) return dependencies.events;
    return typeof window === "undefined" ? null : window;
  };

  const getRequest = (): FetchLike | null => {
    if (dependencies.request) return dependencies.request;
    return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
  };

  const createId = dependencies.createId ?? createClientMutationId;
  const now = dependencies.now ?? Date.now;
  const setTimer = dependencies.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = dependencies.clearTimer ?? ((handle) => clearTimeout(handle));

  function emitProgressChanged(): void {
    getEvents()?.dispatchEvent(new Event(PROGRESS_EVENT));
  }

  function readCache(ownerId: string | null): Progress {
    if (ownerId) return memoryCaches.get(ownerId) ?? EMPTY_PROGRESS;
    const storage = getStorage();
    if (!storage) return EMPTY_PROGRESS;
    try {
      const raw = storage.getItem(cacheKeyFor(ownerId));
      return raw ? parseProgress(JSON.parse(raw)) : EMPTY_PROGRESS;
    } catch {
      return EMPTY_PROGRESS;
    }
  }

  function writeCache(ownerId: string | null, progress: Progress): void {
    if (ownerId) {
      memoryCaches.set(ownerId, progress);
      // Remove pre-server-authoritative v1 account caches during the transition.
      try {
        getStorage()?.removeItem(cacheKeyFor(ownerId));
      } catch {
        // Memory remains the signed-in projection.
      }
      emitProgressChanged();
      return;
    }
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(cacheKeyFor(ownerId), JSON.stringify(progress));
      emitProgressChanged();
    } catch {
      // Storage is best-effort; the durable server projection remains authoritative.
    }
  }

  function quarantineLegacyQueue(): void {
    if (legacyChecked) return;
    const storage = getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(LEGACY_QUEUE_KEY);
      if (!raw) {
        legacyChecked = true;
        return;
      }
      const existing = storage.getItem(LEGACY_QUARANTINE_KEY);
      const quarantineKey =
        existing && existing !== raw
          ? `${LEGACY_QUARANTINE_KEY}:${encodeURIComponent(createId())}`
          : LEGACY_QUARANTINE_KEY;
      if (!storage.getItem(quarantineKey)) storage.setItem(quarantineKey, raw);
      if (storage.getItem(quarantineKey) === raw) {
        storage.removeItem(LEGACY_QUEUE_KEY);
        legacyChecked = true;
      }
    } catch {
      // Never delete the legacy record unless a quarantine copy was persisted.
    }
  }

  function quarantineCorruptRecord(storage: Storage, key: string, raw: string): void {
    const quarantineKey = `${CORRUPT_PREFIX}:${encodeURIComponent(key)}`;
    try {
      if (!storage.getItem(quarantineKey)) {
        storage.setItem(quarantineKey, JSON.stringify({ sourceKey: key, raw }));
      }
      if (storage.getItem(quarantineKey)) storage.removeItem(key);
    } catch {
      // Leave the source record in place if quarantine cannot be persisted.
    }
  }

  function readOutbox(ownerId: string): ProgressDelivery[] {
    quarantineLegacyQueue();
    const storage = getStorage();
    const inMemory = memoryOutboxes.get(ownerId) ?? [];
    if (!storage) return [...inMemory];
    const prefix = outboxPrefixFor(ownerId);
    const keys: string[] = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
    } catch {
      return [...inMemory];
    }

    const deliveries: ProgressDelivery[] = [];
    for (const key of keys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = progressDeliverySchema.safeParse(JSON.parse(raw));
        if (
          !parsed.success ||
          parsed.data.ownerId !== ownerId ||
          key !== outboxKeyFor(ownerId, parsed.data.id)
        ) {
          quarantineCorruptRecord(storage, key, raw);
          continue;
        }
        deliveries.push(parsed.data);
      } catch {
        try {
          const raw = storage.getItem(key);
          if (raw) quarantineCorruptRecord(storage, key, raw);
        } catch {
          // Storage became unavailable during the scan.
        }
      }
    }

    const byId = new Map<string, ProgressDelivery>();
    for (const delivery of [...deliveries, ...inMemory]) byId.set(delivery.id, delivery);
    return [...byId.values()].sort(
      (left, right) =>
        left.createdAt - right.createdAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
  }

  function enqueue(ownerId: string, intent: ProgressIntent): void {
    const delivery: ProgressDelivery = {
      id: createId(),
      ownerId,
      createdAt: now(),
      intent,
    };
    memoryOutboxes.set(ownerId, [...(memoryOutboxes.get(ownerId) ?? []), delivery]);
  }

  function acknowledge(ownerId: string, deliveries: readonly ProgressDelivery[]): void {
    const acknowledgedIds = new Set(deliveries.map(({ id }) => id));
    const remainingMemory = (memoryOutboxes.get(ownerId) ?? []).filter(
      ({ id }) => !acknowledgedIds.has(id),
    );
    if (remainingMemory.length > 0) memoryOutboxes.set(ownerId, remainingMemory);
    else memoryOutboxes.delete(ownerId);

    const storage = getStorage();
    if (!storage) return;
    for (const delivery of deliveries) {
      const key = outboxKeyFor(ownerId, delivery.id);
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const current = progressDeliverySchema.safeParse(JSON.parse(raw));
        if (
          current.success &&
          current.data.ownerId === ownerId &&
          current.data.id === delivery.id
        ) {
          storage.removeItem(key);
        }
      } catch {
        // Keep an unreadable record for quarantine on the next scan.
      }
    }
  }

  async function withOwnerLock(ownerId: string, task: () => Promise<void>): Promise<void> {
    const name = `klab:progress-sync:v2:${ownerToken(ownerId)}`;
    if (dependencies.withLock) return dependencies.withLock(name, task);
    const manager = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (!manager) return task();
    await manager.request(name, { mode: "exclusive" }, task);
  }

  function serialize(ownerId: string, task: () => Promise<void>): Promise<void> {
    const previous = operationTails.get(ownerId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => withOwnerLock(ownerId, task));
    operationTails.set(ownerId, current);
    void current
      .finally(() => {
        if (operationTails.get(ownerId) === current) operationTails.delete(ownerId);
      })
      .catch(() => undefined);
    return current;
  }

  function cancelScheduled(ownerId: string): void {
    const timer = timers.get(ownerId);
    if (timer !== undefined) clearTimer(timer);
    timers.delete(ownerId);
  }

  function scheduleFlush(ownerId: string, delayMs = INITIAL_FLUSH_DELAY_MS): void {
    if (identity !== ownerId || timers.has(ownerId)) return;
    const timer = setTimer(() => {
      timers.delete(ownerId);
      if (identity === ownerId) void flushFor(ownerId);
    }, delayMs);
    timers.set(ownerId, timer);
  }

  function scheduleRetry(ownerId: string): void {
    const attempt = (retryAttempts.get(ownerId) ?? 0) + 1;
    retryAttempts.set(ownerId, attempt);
    const delay = Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.min(attempt - 1, 5));
    scheduleFlush(ownerId, delay);
  }

  function clearRetry(ownerId: string): void {
    retryAttempts.delete(ownerId);
    cancelScheduled(ownerId);
  }

  async function drainOutbox(ownerId: string, epoch: number, keepalive: boolean): Promise<void> {
    if (identity !== ownerId || runtimeEpoch !== epoch) return;
    const request = getRequest();
    if (!request) return;

    let batches = 0;
    while (identity === ownerId && runtimeEpoch === epoch && batches < MAX_BATCHES_PER_FLUSH) {
      const deliveries = readOutbox(ownerId).slice(0, MAX_BATCH_SIZE);
      if (deliveries.length === 0) {
        clearRetry(ownerId);
        return;
      }

      let response: Response;
      try {
        response = await request("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ownerId, deliveries }),
          keepalive,
        });
      } catch {
        scheduleRetry(ownerId);
        return;
      }

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) scheduleRetry(ownerId);
        return;
      }

      let payload;
      try {
        payload = parseProgressSyncResponse(await response.json());
      } catch {
        // A malformed success must never acknowledge durable work.
        return;
      }

      const acknowledged = new Set(payload.acknowledgedIds);
      const exactAcknowledgement =
        payload.ownerId === ownerId &&
        payload.acknowledgedIds.length === deliveries.length &&
        acknowledged.size === deliveries.length &&
        deliveries.every(({ id }) => acknowledged.has(id));
      if (!exactAcknowledgement || runtimeEpoch !== epoch) return;

      acknowledge(ownerId, deliveries);
      const remaining = readOutbox(ownerId);
      writeCache(
        ownerId,
        remaining.reduce(
          (progress, delivery) => applyIntent(progress, delivery.intent),
          payload.progress,
        ),
      );
      clearRetry(ownerId);
      batches += 1;
    }

    if (identity === ownerId && readOutbox(ownerId).length > 0) scheduleFlush(ownerId, 0);
  }

  function flushFor(ownerId: string, keepalive = false): Promise<void> {
    const existing = flushes.get(ownerId);
    if (existing) return existing;
    const epoch = runtimeEpoch;
    const operation = serialize(ownerId, () => drainOutbox(ownerId, epoch, keepalive)).catch(
      () => undefined,
    );
    flushes.set(ownerId, operation);
    void operation.finally(() => {
      if (flushes.get(ownerId) === operation) flushes.delete(ownerId);
    });
    return operation;
  }

  async function readRemote(ownerId: string, epoch: number): Promise<void> {
    if (identity !== ownerId || runtimeEpoch !== epoch) return;
    const request = getRequest();
    if (!request) return;
    try {
      const response = await request("/api/progress", {
        headers: { [PROGRESS_OWNER_HEADER]: ownerId },
      });
      if (!response.ok) return;
      const snapshot = parseProgress(await response.json());
      if (runtimeEpoch !== epoch) return;
      const merged = readOutbox(ownerId).reduce(
        (progress, delivery) => applyIntent(progress, delivery.intent),
        snapshot,
      );
      writeCache(ownerId, merged);
    } catch {
      // Offline or malformed response: retain the local projection.
    }
  }

  function pullFor(ownerId: string): Promise<void> {
    const existing = pulls.get(ownerId);
    if (existing) return existing;
    const epoch = runtimeEpoch;
    const operation = (async () => {
      await flushFor(ownerId);
      if (identity !== ownerId || runtimeEpoch !== epoch) return;
      await serialize(ownerId, () => readRemote(ownerId, epoch));
    })().catch(() => undefined);
    pulls.set(ownerId, operation);
    void operation.finally(() => {
      if (pulls.get(ownerId) === operation) pulls.delete(ownerId);
    });
    return operation;
  }

  async function mergeGuest(ownerId: string, epoch: number): Promise<void> {
    if (identity !== ownerId || runtimeEpoch !== epoch) return;
    const storage = getStorage();
    const request = getRequest();
    if (!storage || !request) return;

    const guest = readCache(null);
    const hasGuestFacts =
      guest.solvedLevelSlugs.length > 0 ||
      guest.attemptedLevelSlugs.length > 0 ||
      guest.savedProblemSlugs.length > 0 ||
      guest.completedLessonSlugs.length > 0 ||
      Object.keys(guest.hintReveals).length > 0;
    if (!hasGuestFacts) return;
    if (runtimeEpoch !== epoch || identity !== ownerId) return;

    try {
      const response = await request("/api/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerId, progress: guest }),
      });
      if (!response.ok) return;
      const payload = parseMergeResponse(await response.json());
      if (runtimeEpoch !== epoch || payload.ownerId !== ownerId) return;
      // A successful account claim removes the guest copy so a later account on this
      // browser cannot inherit the same progress. Server-side merge_log is the retry guard.
      storage.removeItem(PROGRESS_STORAGE_KEY);
      storage.removeItem(mergeMarkerKeyFor(ownerId));
      const merged = readOutbox(ownerId).reduce(
        (progress, delivery) => applyIntent(progress, delivery.intent),
        payload.progress,
      );
      writeCache(ownerId, merged);
    } catch {
      // No marker is written, so focus/online/the next sign-in retries safely.
    }
  }

  function mergeFor(ownerId: string): Promise<void> {
    const existing = merges.get(ownerId);
    if (existing) return existing;
    const epoch = runtimeEpoch;
    const operation = serialize(ownerId, () => mergeGuest(ownerId, epoch)).catch(() => undefined);
    merges.set(ownerId, operation);
    void operation.finally(() => {
      if (merges.get(ownerId) === operation) merges.delete(ownerId);
    });
    return operation;
  }

  async function wake(ownerId: string): Promise<void> {
    await mergeFor(ownerId);
    if (identity !== ownerId) return;
    await flushFor(ownerId);
    if (identity !== ownerId) return;
    await pullFor(ownerId);
  }

  return {
    getProgress(): Progress {
      quarantineLegacyQueue();
      return readCache(identity);
    },

    getIdentity(): string | null {
      return identity;
    },

    mutateProgress(intent: ProgressIntent): void {
      quarantineLegacyQueue();
      const ownerId = identity;
      writeCache(ownerId, applyIntent(readCache(ownerId), intent));
      if (ownerId) {
        enqueue(ownerId, intent);
        scheduleFlush(ownerId);
      }
    },

    async flush(): Promise<void> {
      const ownerId = identity;
      if (ownerId) await flushFor(ownerId);
    },

    async pullRemote(): Promise<void> {
      const ownerId = identity;
      if (ownerId) await pullFor(ownerId);
    },

    async setIdentity(id: string | null): Promise<void> {
      quarantineLegacyQueue();
      if (id === identity) return;
      const previous = identity;
      if (previous) cancelScheduled(previous);
      identity = id;
      emitProgressChanged();
      if (id) await wake(id);
    },

    bindSyncListeners(): () => void {
      quarantineLegacyQueue();
      if (disposeListeners) return disposeListeners;
      const events = getEvents();
      if (!events) return () => undefined;

      const onOnline = () => {
        const ownerId = identity;
        if (ownerId) void wake(ownerId);
      };
      const onFocus = onOnline;
      const onPageHide = () => {
        const ownerId = identity;
        if (ownerId) void flushFor(ownerId, true);
      };
      const onStorage = (event: Event) => {
        const ownerId = identity;
        const key = (event as StorageEvent).key;
        if (!key) return;
        if (key === LEGACY_QUEUE_KEY) {
          legacyChecked = false;
          quarantineLegacyQueue();
          return;
        }
        if (!ownerId) return;
        if (key === cacheKeyFor(ownerId)) emitProgressChanged();
        if (key.startsWith(outboxPrefixFor(ownerId))) {
          emitProgressChanged();
          scheduleFlush(ownerId, 0);
        }
      };

      events.addEventListener("online", onOnline);
      events.addEventListener("focus", onFocus);
      events.addEventListener("pagehide", onPageHide);
      events.addEventListener("storage", onStorage);
      disposeListeners = () => {
        events.removeEventListener("online", onOnline);
        events.removeEventListener("focus", onFocus);
        events.removeEventListener("pagehide", onPageHide);
        events.removeEventListener("storage", onStorage);
        disposeListeners = null;
      };
      return disposeListeners;
    },

    hasPending(ownerId: string): boolean {
      return readOutbox(ownerId).length > 0;
    },

    clearIdentityData(ownerId: string): void {
      cancelScheduled(ownerId);
      memoryCaches.delete(ownerId);
      memoryOutboxes.delete(ownerId);
      if (identity === ownerId) {
        runtimeEpoch += 1;
        identity = null;
        emitProgressChanged();
      }
    },

    reset(): void {
      runtimeEpoch += 1;
      identity = null;
      for (const timer of timers.values()) clearTimer(timer);
      timers.clear();
      retryAttempts.clear();
      operationTails.clear();
      flushes.clear();
      pulls.clear();
      merges.clear();
      memoryCaches.clear();
      memoryOutboxes.clear();
      disposeListeners?.();
      legacyChecked = false;
    },
  };
}

const browserStore = createProgressStore();

export const getProgress = (): Progress => browserStore.getProgress();
export const getIdentity = (): string | null => browserStore.getIdentity();
export const mutateProgress = (intent: ProgressIntent): void => browserStore.mutateProgress(intent);
export const flush = (): Promise<void> => browserStore.flush();
export const pullRemote = (): Promise<void> => browserStore.pullRemote();
export const setIdentity = (id: string | null): Promise<void> => browserStore.setIdentity(id);
export const bindSyncListeners = (): (() => void) => browserStore.bindSyncListeners();

/** Flush before sign-out/deletion; false means the account must stay active for retry. */
export async function flushProgressForAccountExit(ownerId: string): Promise<boolean> {
  if (browserStore.getIdentity() !== ownerId) return true;
  await browserStore.flush();
  return !browserStore.hasPending(ownerId);
}

/** Remove account-identifying artifacts after server sign-out or deletion succeeds. */
export function clearUserProgressStorage(ownerId: string): void {
  browserStore.clearIdentityData(ownerId);
  if (typeof window === "undefined") return;
  const outboxPrefix = outboxPrefixFor(ownerId);
  const encodedOutboxPrefix = encodeURIComponent(outboxPrefix);
  const keys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        (key === cacheKeyFor(ownerId) ||
          key === mergeMarkerKeyFor(ownerId) ||
          key.startsWith(outboxPrefix) ||
          (key.startsWith(CORRUPT_PREFIX) && key.includes(encodedOutboxPrefix)))
      ) {
        keys.push(key);
      }
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // The browser may deny storage access; no persistent write is attempted afterward.
  }
}

/** Remove unclaimed guest progress when an authenticated browser session exits. */
export function clearGuestProgressStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_QUEUE_KEY);
    window.localStorage.removeItem(LEGACY_QUARANTINE_KEY);
  } catch {
    // Browser storage may already be unavailable.
  }
}

/** Reset in-memory runtime state without erasing any user's durable outbox. */
export const resetProgressStore = (): void => browserStore.reset();
