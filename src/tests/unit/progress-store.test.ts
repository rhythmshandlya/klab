import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Progress } from "@/lib/storage/local-progress";
import {
  flush,
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
  hintPenalties: {},
  attemptedLevelSlugs: ["a", "b"],
  savedProblemSlugs: [],
  lastSolvedDay: "2026-07-09",
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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

describe("progress-store — guest", () => {
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
    expect(p.hintPenalties).toEqual({ x: 15 });
    expect(p.solvedLevelSlugs).toEqual(["x"]);
    expect(p.xp).toBe(85); // 100 − 15, netted by recordSolved
  });
});

describe("progress-store — signed in", () => {
  it("merges + pulls on sign-in, then pushes queued intents", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/merge")) return Promise.resolve(jsonResponse(SNAPSHOT));
      if (url.includes("/api/progress")) {
        void method;
        return Promise.resolve(jsonResponse(SNAPSHOT));
      }
      return Promise.resolve(new Response("nope", { status: 404 }));
    });
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
    const body = JSON.parse(String(posts[0]![1]!.body)) as { intents: unknown[] };
    expect(body.intents[0]).toMatchObject({ kind: "solved", slug: "c" });
  });

  it("keeps guest and signed-in caches separate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(SNAPSHOT))),
    );
    // Guest writes something first.
    mutateProgress({ kind: "solved", slug: "guest-only", xp: 100, day: "2026-07-09" });
    expect(getProgress().solvedLevelSlugs).toEqual(["guest-only"]);

    await setIdentity("u1");
    // Signed-in view is the server snapshot, not the guest's.
    expect(getProgress().solvedLevelSlugs).toEqual(["a", "b"]);

    await setIdentity(null);
    // Back to the guest cache, intact.
    expect(getProgress().solvedLevelSlugs).toEqual(["guest-only"]);
  });
});
