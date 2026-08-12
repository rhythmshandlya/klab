import { afterEach, describe, expect, it, vi } from "vitest";

const discussionId = "123e4567-e89b-42d3-a456-426614174000";
const replyId = "223e4567-e89b-42d3-a456-426614174000";
const mocks = vi.hoisted(() => ({
  userId: "member-1" as string | null,
  allow: true,
  createDiscussion: vi.fn(async () => ({ id: discussionId })),
  createDiscussionReply: vi.fn(async (): Promise<unknown> => ({ id: replyId })),
  moderateDiscussion: vi.fn(async (): Promise<unknown> => ({ id: discussionId })),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    api: { getSession: async () => (mocks.userId ? { user: { id: mocks.userId } } : null) },
  }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}), hasDb: () => true }));
vi.mock("@/lib/env", () => ({ isAuthConfigured: () => true }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: async () => mocks.allow }));
vi.mock("@/lib/db/discussions-repo", () => ({
  createDiscussion: mocks.createDiscussion,
  createDiscussionReply: mocks.createDiscussionReply,
  moderateDiscussion: mocks.moderateDiscussion,
}));

import { POST as createDiscussionPost } from "@/app/api/community/discussions/route";
import { PATCH as moderateDiscussionPatch } from "@/app/api/community/discussions/[discussionId]/moderate/route";
import { POST as createReplyPost } from "@/app/api/community/discussions/[discussionId]/replies/route";

const routeContext = { params: Promise.resolve({ discussionId }) };

afterEach(() => {
  mocks.userId = "member-1";
  mocks.allow = true;
  mocks.createDiscussionReply.mockResolvedValue({ id: replyId });
  mocks.moderateDiscussion.mockResolvedValue({ id: discussionId });
  vi.clearAllMocks();
});

describe("community discussion routes", () => {
  it("requires authentication before accepting authored content", async () => {
    mocks.userId = null;
    const response = await createDiscussionPost(
      new Request("http://test/api/community/discussions", { method: "POST", body: "{}" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createDiscussion).not.toHaveBeenCalled();
  });

  it("validates and creates a discussion for the session user", async () => {
    const response = await createDiscussionPost(
      new Request("http://test/api/community/discussions", {
        method: "POST",
        body: JSON.stringify({
          clientId: "discussion-route-0001",
          category: "problem",
          title: "Add a broken NetworkPolicy problem",
          body: "A scenario where DNS works but ingress traffic is denied would be useful.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createDiscussion).toHaveBeenCalledWith(
      {},
      "member-1",
      expect.objectContaining({ category: "problem" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/community/discussions");
  });

  it("reports closed threads without creating another reply", async () => {
    mocks.createDiscussionReply.mockResolvedValueOnce("closed");
    const response = await createReplyPost(
      new Request(`http://test/api/community/discussions/${discussionId}/replies`, {
        method: "POST",
        body: JSON.stringify({
          clientId: "reply-route-0001",
          body: "This is my response.",
          parentId: null,
        }),
      }),
      routeContext,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "This discussion is closed." });
  });

  it("does not expose moderation to a non-official session", async () => {
    mocks.moderateDiscussion.mockResolvedValueOnce("forbidden");
    const response = await moderateDiscussionPatch(
      new Request(`http://test/api/community/discussions/${discussionId}/moderate`, {
        method: "PATCH",
        body: JSON.stringify({ status: "planned" }),
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(mocks.moderateDiscussion).toHaveBeenCalledWith({}, "member-1", discussionId, {
      status: "planned",
    });
  });

  it("enforces per-user rate limits before validation", async () => {
    mocks.allow = false;
    const response = await createReplyPost(
      new Request(`http://test/api/community/discussions/${discussionId}/replies`, {
        method: "POST",
        body: "{}",
      }),
      routeContext,
    );

    expect(response.status).toBe(429);
    expect(mocks.createDiscussionReply).not.toHaveBeenCalled();
  });
});
