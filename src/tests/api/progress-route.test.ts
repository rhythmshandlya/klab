import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user-B" as string | null,
  applyIntents: vi.fn(async () => undefined),
  mergeGuestProgress: vi.fn(async () => ({
    fingerprint: "v1:1234567890abcdef",
    merged: true,
  })),
  readProgress: vi.fn(async () => ({
    version: 1 as const,
    xp: 0,
    streakDays: 0,
    solvedLevelSlugs: [],
    hintReveals: {},
    attemptedLevelSlugs: [],
    savedProblemSlugs: [],
    completedLessonSlugs: [],
  })),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    api: {
      getSession: async () => (mocks.userId ? { user: { id: mocks.userId } } : null),
    },
  }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}), hasDb: () => true }));
vi.mock("@/lib/env", () => ({ isAuthConfigured: () => true }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: async () => true }));
vi.mock("@/lib/db/progress-repo", () => {
  class InvalidProgressIntentError extends Error {}
  return {
    applyIntents: mocks.applyIntents,
    InvalidProgressIntentError,
    readProgress: mocks.readProgress,
  };
});
vi.mock("@/lib/db/merge-repo", () => ({ mergeGuestProgress: mocks.mergeGuestProgress }));

import { POST as mergePost } from "@/app/api/merge/route";
import { GET as progressGet, POST as progressPost } from "@/app/api/progress/route";
import { EMPTY_PROGRESS } from "@/lib/storage/local-progress";

function delivery(ownerId: string) {
  return {
    id: "delivery-00000001",
    ownerId,
    createdAt: 1,
    intent: { kind: "attempted", slug: "broken-readiness-probe" },
  };
}

afterEach(() => {
  mocks.userId = "user-B";
  vi.clearAllMocks();
});

describe("progress route ownership contract", () => {
  it("rejects A's write while the authenticated session belongs to B", async () => {
    const response = await progressPost(
      new Request("http://test/api/progress", {
        method: "POST",
        body: JSON.stringify({ ownerId: "user-A", deliveries: [delivery("user-A")] }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.applyIntents).not.toHaveBeenCalled();
  });

  it("acknowledges delivery IDs only for the authenticated owner", async () => {
    const response = await progressPost(
      new Request("http://test/api/progress", {
        method: "POST",
        body: JSON.stringify({ ownerId: "user-B", deliveries: [delivery("user-B")] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.applyIntents).toHaveBeenCalledWith({}, "user-B", [
      expect.objectContaining({ kind: "attempted" }),
    ]);
    await expect(response.json()).resolves.toMatchObject({
      ownerId: "user-B",
      acknowledgedIds: ["delivery-00000001"],
    });
  });

  it("rejects a read whose captured owner differs from the session", async () => {
    const response = await progressGet(
      new Request("http://test/api/progress", {
        headers: { "x-klab-progress-owner": "user-A" },
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.readProgress).not.toHaveBeenCalled();
  });

  it("rejects a guest merge for a different authenticated owner", async () => {
    const response = await mergePost(
      new Request("http://test/api/merge", {
        method: "POST",
        body: JSON.stringify({ ownerId: "user-A", progress: EMPTY_PROGRESS }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.mergeGuestProgress).not.toHaveBeenCalled();
  });
});
