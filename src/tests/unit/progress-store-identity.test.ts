import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_PROGRESS, progressFingerprint, type Progress } from "@/lib/storage/local-progress";
import { createProgressStore } from "@/lib/storage/progress-store";
import type { ProgressDelivery } from "@/lib/storage/progress-intent";

function jsonResponse(value: unknown): Response {
  return Response.json(value);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function idSequence(): () => string {
  let value = 0;
  return () => `delivery-${String(++value).padStart(8, "0")}`;
}

function sharedLock() {
  let tail = Promise.resolve();
  return async (_name: string, task: () => Promise<void>): Promise<void> => {
    const current = tail.catch(() => undefined).then(task);
    tail = current.catch(() => undefined);
    await current;
  };
}

type Batch = { ownerId: string; deliveries: ProgressDelivery[] };

async function mergeReply(body: string | null, progress = EMPTY_PROGRESS): Promise<Response> {
  const request = JSON.parse(body ?? "null") as { ownerId: string; progress: Progress };
  return jsonResponse({
    ownerId: request.ownerId,
    fingerprint: await progressFingerprint(request.progress),
    progress,
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("progress store identity isolation", () => {
  it("keeps A's offline delivery dormant while B is active", async () => {
    const batches: Batch[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batches.push(batch);
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: EMPTY_PROGRESS,
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    store.mutateProgress({ kind: "attempted", slug: "a-offline" });
    await store.setIdentity("B");

    expect(batches).toHaveLength(0);
    store.mutateProgress({ kind: "attempted", slug: "b-online" });
    await store.flush();
    expect(batches.map(({ ownerId }) => ownerId)).toEqual(["B"]);
    expect(batches[0]!.deliveries[0]!.intent).toMatchObject({ slug: "b-online" });

    await store.setIdentity("A");
    expect(batches.map(({ ownerId }) => ownerId)).toEqual(["B", "A"]);
    expect(batches[1]!.deliveries[0]!.intent).toMatchObject({ slug: "a-offline" });
    store.reset();
  });

  it("writes a late A response only to A's cache after switching to B", async () => {
    const held = deferred<Response>();
    let holdA = false;
    let heldBatch: Batch | null = null;
    let snapshotA: Progress = EMPTY_PROGRESS;
    const snapshotB: Progress = {
      ...EMPTY_PROGRESS,
      completedLessonSlugs: ["b/server"],
    };
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) {
        const body = JSON.parse(String(init?.body)) as { ownerId: string };
        return mergeReply(String(init?.body), body.ownerId === "B" ? snapshotB : EMPTY_PROGRESS);
      }
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        if (batch.ownerId === "A" && holdA) {
          heldBatch = batch;
          return held.promise;
        }
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: EMPTY_PROGRESS,
        });
      }
      const owner = new Headers(init?.headers).get("x-klab-progress-owner");
      return jsonResponse(owner === "B" ? snapshotB : snapshotA);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    store.mutateProgress({ kind: "attempted", slug: "a-pending" });
    holdA = true;
    const aFlush = store.flush();
    await vi.waitFor(() => expect(heldBatch).not.toBeNull());

    await store.setIdentity("B");
    expect(store.getProgress().completedLessonSlugs).toEqual(["b/server"]);

    const batch = heldBatch!;
    snapshotA = { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["a-pending"] };
    held.resolve(
      jsonResponse({
        ownerId: "A",
        acknowledgedIds: batch.deliveries.map(({ id }) => id),
        progress: snapshotA,
      }),
    );
    await aFlush;

    expect(store.getIdentity()).toBe("B");
    expect(store.getProgress().completedLessonSlugs).toEqual(["b/server"]);
    expect(localStorage.getItem("klab:progress:v1:u:A")).toBeNull();
    holdA = false;
    await store.setIdentity("A");
    expect(store.getProgress().attemptedLevelSlugs).toEqual(["a-pending"]);
    store.reset();
  });

  it("acknowledges exact IDs and preserves a delivery queued during a flush", async () => {
    const firstResponse = deferred<Response>();
    const batches: Batch[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batches.push(batch);
        if (batches.length === 1) return firstResponse.promise;
        return jsonResponse({
          ownerId: "A",
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["first", "second"] },
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    store.mutateProgress({ kind: "attempted", slug: "first" });
    const flushing = store.flush();
    await vi.waitFor(() => expect(batches).toHaveLength(1));
    store.mutateProgress({ kind: "attempted", slug: "second" });

    firstResponse.resolve(
      jsonResponse({
        ownerId: "A",
        acknowledgedIds: batches[0]!.deliveries.map(({ id }) => id),
        progress: { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["first"] },
      }),
    );
    await flushing;

    expect(batches).toHaveLength(2);
    expect(batches[0]!.deliveries.map(({ intent }) => intent)).toMatchObject([{ slug: "first" }]);
    expect(batches[1]!.deliveries.map(({ intent }) => intent)).toMatchObject([{ slug: "second" }]);
    expect(store.getProgress().attemptedLevelSlugs).toEqual(["first", "second"]);
    store.reset();
  });

  it("persists signed-in progress even when persistent browser storage is unavailable", async () => {
    const batches: Batch[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batches.push(batch);
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["without-storage"] },
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({
      storage: null,
      request,
      createId: () => "delivery-no-storage-0001",
    });

    await store.setIdentity("A");
    store.mutateProgress({ kind: "attempted", slug: "without-storage" });
    await store.flush();

    expect(batches).toHaveLength(1);
    expect(store.getProgress().attemptedLevelSlugs).toEqual(["without-storage"]);
    store.reset();
  });

  it("does not acknowledge an invalid 200 response", async () => {
    const batches: Batch[] = [];
    let valid = false;
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batches.push(batch);
        if (!valid) return jsonResponse({ progress: null });
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["retry-me"] },
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    store.mutateProgress({ kind: "attempted", slug: "retry-me" });
    await store.flush();
    valid = true;
    await store.flush();

    expect(batches).toHaveLength(2);
    expect(batches[1]!.deliveries[0]!.id).toBe(batches[0]!.deliveries[0]!.id);
    expect(store.getProgress().attemptedLevelSlugs).toEqual(["retry-me"]);
    store.reset();
  });

  it("serializes two tabs and preserves both independently stored deliveries", async () => {
    const batches: Batch[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batches.push(batch);
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: {
            ...EMPTY_PROGRESS,
            attemptedLevelSlugs: batch.deliveries.map(({ intent }) => intent.slug),
          },
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const withLock = sharedLock();
    const tabOne = createProgressStore({
      request,
      withLock,
      createId: () => "delivery-tab-one-0001",
    });
    const tabTwo = createProgressStore({
      request,
      withLock,
      createId: () => "delivery-tab-two-0001",
    });

    await tabOne.setIdentity("A");
    await tabTwo.setIdentity("A");
    tabOne.mutateProgress({ kind: "attempted", slug: "from-tab-one" });
    tabTwo.mutateProgress({ kind: "attempted", slug: "from-tab-two" });
    await Promise.all([tabOne.flush(), tabTwo.flush()]);

    expect(batches).toHaveLength(2);
    expect(
      batches.flatMap((batch) => batch.deliveries.map(({ intent }) => intent.slug)).sort(),
    ).toEqual(["from-tab-one", "from-tab-two"]);
    expect(localStorage.length).toBe(0);
    tabOne.reset();
    tabTwo.reset();
  });

  it("drains an oversized outbox in bounded batches", async () => {
    const batchSizes: number[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        const batch = JSON.parse(String(init.body)) as Batch;
        batchSizes.push(batch.deliveries.length);
        return jsonResponse({
          ownerId: batch.ownerId,
          acknowledgedIds: batch.deliveries.map(({ id }) => id),
          progress: EMPTY_PROGRESS,
        });
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    for (let index = 0; index < 201; index += 1) {
      store.mutateProgress({
        kind: "submission",
        slug: "broken-readiness-probe",
        passed: true,
        checksTotal: 1,
        checksPassed: 1,
        clientMutationId: `submission-batch-${String(index).padStart(6, "0")}`,
      });
    }
    await store.flush();

    expect(batchSizes).toEqual([200, 1]);
    store.reset();
  });

  it("finishes a focus push before starting the pull", async () => {
    const held = deferred<Response>();
    let heldBatch: Batch | null = null;
    let reads = 0;
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) return mergeReply(String(init?.body));
      if (url.includes("/api/progress") && init?.method === "POST") {
        heldBatch = JSON.parse(String(init.body)) as Batch;
        return held.promise;
      }
      reads += 1;
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    const baselineReads = reads;
    store.mutateProgress({ kind: "attempted", slug: "focus-order" });
    store.bindSyncListeners();
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(heldBatch).not.toBeNull());
    expect(reads).toBe(baselineReads);

    const batch = heldBatch!;
    held.resolve(
      jsonResponse({
        ownerId: "A",
        acknowledgedIds: batch.deliveries.map(({ id }) => id),
        progress: { ...EMPTY_PROGRESS, attemptedLevelSlugs: ["focus-order"] },
      }),
    );
    await vi.waitFor(() => expect(reads).toBe(baselineReads + 1));
    store.reset();
  });

  it("merges again only when the guest fact fingerprint changes", async () => {
    const mergeFingerprints: string[] = [];
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merge")) {
        const body = JSON.parse(String(init?.body)) as { progress: Progress };
        mergeFingerprints.push(await progressFingerprint(body.progress));
        return mergeReply(String(init?.body));
      }
      return jsonResponse(EMPTY_PROGRESS);
    });
    const store = createProgressStore({ request, createId: idSequence() });

    await store.setIdentity("A");
    await store.setIdentity(null);
    store.mutateProgress({ kind: "attempted", slug: "new-guest-fact" });
    await store.setIdentity("A");
    await store.setIdentity(null);
    await store.setIdentity("A");

    expect(mergeFingerprints).toHaveLength(1);
    store.reset();
  });
});
