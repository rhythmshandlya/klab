import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_PROGRESS, progressFingerprint, type Progress } from "@/lib/storage/local-progress";
import {
  clearGuestProgressStorage,
  clearUserProgressStorage,
  flush,
  flushProgressForAccountExit,
  getProgress,
  mutateProgress,
  resetProgressStore,
  setIdentity,
} from "@/lib/storage/progress-store";

const SNAPSHOT: Progress = {
  version: 1,
  xp: 250,
  streakDays: 2,
  solvedLevelSlugs: ["a", "b"],
  hintReveals: {},
  attemptedLevelSlugs: ["a", "b"],
  savedProblemSlugs: [],
  completedLessonSlugs: [],
  lastSolvedDay: "2026-07-09",
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function remoteReturning(snapshot: Progress) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("/api/merge")) {
      const body = JSON.parse(String(init?.body)) as { ownerId: string; progress: Progress };
      return jsonResponse({
        ownerId: body.ownerId,
        fingerprint: await progressFingerprint(body.progress),
        progress: snapshot,
      });
    }
    if (url.includes("/api/progress") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as {
        ownerId: string;
        deliveries: { id: string }[];
      };
      return jsonResponse({
        ownerId: body.ownerId,
        acknowledgedIds: body.deliveries.map(({ id }) => id),
        progress: snapshot,
      });
    }
    if (url.includes("/api/progress")) return jsonResponse(snapshot);
    return new Response("nope", { status: 404 });
  };
}

beforeEach(() => {
  localStorage.clear();
  resetProgressStore();
});
afterEach(() => {
  resetProgressStore();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("progress-store: guest", () => {
  it("applies mutations to the local cache with no network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mutateProgress({ kind: "attempted", slug: "a" });
    mutateProgress({ kind: "solved", slug: "a", xp: 100, day: "2026-07-09" });

    const p = getProgress();
    expect(p.solvedLevelSlugs).toEqual(["a"]);
    expect(p.attemptedLevelSlugs).toEqual(["a"]);
    expect(p.xp).toBe(100);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("composes rapid sequential mutations without losing updates", () => {
    mutateProgress({ kind: "attempted", slug: "x" });
    mutateProgress({ kind: "revealHint", slug: "x", hintId: "h1", penalty: 15 });
    mutateProgress({ kind: "solved", slug: "x", xp: 100, day: "2026-07-09" });

    const p = getProgress();
    expect(p.attemptedLevelSlugs).toEqual(["x"]);
    expect(p.hintReveals).toEqual({ x: { h1: 15 } });
    expect(p.solvedLevelSlugs).toEqual(["x"]);
    expect(p.xp).toBe(85); // 100 − 15, netted by recordSolved
  });

  it("does not charge twice when the same hint intent is replayed", () => {
    const reveal = { kind: "revealHint", slug: "x", hintId: "h1", penalty: 15 } as const;
    mutateProgress(reveal);
    mutateProgress(reveal);

    expect(getProgress().hintReveals).toEqual({ x: { h1: 15 } });
    mutateProgress({ kind: "solved", slug: "x", xp: 100, day: "2026-07-09" });
    expect(getProgress().xp).toBe(85);
  });
});

describe("progress-store: signed in", () => {
  it("merges + pulls on sign-in, then pushes queued intents", async () => {
    const fetchMock = vi.fn(remoteReturning(SNAPSHOT));
    vi.stubGlobal("fetch", fetchMock);

    await setIdentity("u1");
    // Adopted the server snapshot into the identity-scoped cache.
    expect(getProgress().xp).toBe(250);
    expect(getProgress().solvedLevelSlugs).toEqual(["a", "b"]);

    // A new mutation is reflected optimistically and queued.
    mutateProgress({ kind: "solved", slug: "c", xp: 50, day: "2026-07-10" });
    expect(getProgress().solvedLevelSlugs).toContain("c");

    await flush();
    const posts = fetchMock.mock.calls.filter(
      ([u, i]) => String(u).includes("/api/progress") && i?.method === "POST",
    );
    expect(posts.length).toBeGreaterThan(0);
    const body = JSON.parse(String(posts[0]![1]!.body)) as {
      ownerId: string;
      deliveries: { ownerId: string; intent: unknown }[];
    };
    expect(body.ownerId).toBe("u1");
    expect(body.deliveries[0]).toMatchObject({
      ownerId: "u1",
      intent: { kind: "solved", slug: "c" },
    });
  });

  it("keeps guest and signed-in caches separate", async () => {
    vi.stubGlobal("fetch", vi.fn(remoteReturning(SNAPSHOT)));
    // Guest writes something first.
    mutateProgress({ kind: "solved", slug: "guest-only", xp: 100, day: "2026-07-09" });
    expect(getProgress().solvedLevelSlugs).toEqual(["guest-only"]);

    await setIdentity("u1");
    // Signed-in view is the server snapshot, not the guest's.
    expect(getProgress().solvedLevelSlugs).toEqual(["a", "b"]);

    await setIdentity(null);
    // The successful account claim removes the guest copy to prevent cross-account import.
    expect(getProgress().solvedLevelSlugs).toEqual([]);
  });

  it("does not send an ambiguous ownerless v1 queue", async () => {
    localStorage.setItem(
      "klab:sync-queue:v1",
      JSON.stringify([{ kind: "attempted", slug: "must-not-cross-accounts" }]),
    );
    const fetchMock = vi.fn(remoteReturning(EMPTY_PROGRESS));
    vi.stubGlobal("fetch", fetchMock);

    await setIdentity("u2");

    expect(localStorage.getItem("klab:sync-queue:v1")).toBeNull();
    expect(localStorage.getItem("klab:sync-quarantine:v1:ownerless")).not.toBeNull();
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) => String(url).includes("/api/progress") && init?.method === "POST",
      ),
    ).toHaveLength(0);
  });

  it("blocks account exit while a server write is still pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/progress")
          ? new Response("offline", { status: 503 })
          : jsonResponse(EMPTY_PROGRESS),
      ),
    );
    await setIdentity("u1");
    mutateProgress({ kind: "attempted", slug: "must-sync-first" });

    await expect(flushProgressForAccountExit("u1")).resolves.toBe(false);
  });

  it("clears only the exiting account's legacy browser artifacts", () => {
    localStorage.setItem("klab:progress:v1:u:u1", "{}");
    localStorage.setItem("klab:sync-outbox:v2:u:u1:e:one", "{}");
    localStorage.setItem("klab:merged:v2:u:u1", "fingerprint");
    localStorage.setItem("klab:progress:v1:u:u2", "keep");

    clearUserProgressStorage("u1");

    expect(localStorage.getItem("klab:progress:v1:u:u1")).toBeNull();
    expect(localStorage.getItem("klab:sync-outbox:v2:u:u1:e:one")).toBeNull();
    expect(localStorage.getItem("klab:merged:v2:u:u1")).toBeNull();
    expect(localStorage.getItem("klab:progress:v1:u:u2")).toBe("keep");
  });

  it("clears unclaimed guest progress after an account exits", () => {
    localStorage.setItem("klab:progress:v1", JSON.stringify(SNAPSHOT));
    localStorage.setItem("klab:sync-queue:v1", "[]");

    clearGuestProgressStorage();

    expect(localStorage.getItem("klab:progress:v1")).toBeNull();
    expect(localStorage.getItem("klab:sync-queue:v1")).toBeNull();
  });
});
