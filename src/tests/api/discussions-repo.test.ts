import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createDiscussion,
  createDiscussionReply,
  moderateDiscussion,
  readDiscussion,
  readDiscussions,
} from "@/lib/db/discussions-repo";
import { user } from "@/lib/db/schema";
import type { DiscussionCategory } from "@/lib/community/contracts";

import { createTestDb, seedUser } from "./pglite";

const discussionInput = (clientId: string, category: DiscussionCategory = "general") => ({
  clientId,
  category,
  title: "Service selector does not match pods",
  body: "I can reproduce a selector mismatch and would like help understanding the events.",
});

describe("discussions repository over pglite", () => {
  it("creates retry-safe public discussions and derives reply counts", async () => {
    const { db, client } = await createTestDb();
    try {
      const authorId = await seedUser(db, "discussion-author");
      const first = await createDiscussion(db, authorId, discussionInput("discussion-0001"));
      const retried = await createDiscussion(db, authorId, discussionInput("discussion-0001"));

      expect(retried.id).toBe(first.id);
      expect(await readDiscussions(db, { limit: 10 })).toHaveLength(1);

      const reply = await createDiscussionReply(db, authorId, first.id, {
        clientId: "reply-0001",
        body: "The labels differ in the Service selector.",
        parentId: null,
      });
      expect(reply).not.toBe("not-found");
      expect(reply).not.toBe("closed");

      const retriedReply = await createDiscussionReply(db, authorId, first.id, {
        clientId: "reply-0001",
        body: "The labels differ in the Service selector.",
        parentId: null,
      });
      expect(typeof retriedReply === "string" ? retriedReply : retriedReply.id).toBe(
        typeof reply === "string" ? reply : reply.id,
      );

      const thread = await readDiscussion(db, first.id);
      expect(thread?.discussion.replyCount).toBe(1);
      expect(thread?.replies).toHaveLength(1);
    } finally {
      await client.close();
    }
  });

  it("keeps threads two levels deep and rejects parents from another discussion", async () => {
    const { db, client } = await createTestDb();
    try {
      const authorId = await seedUser(db, "thread-author");
      const first = await createDiscussion(db, authorId, discussionInput("discussion-1001"));
      const second = await createDiscussion(db, authorId, discussionInput("discussion-1002"));
      const root = await createDiscussionReply(db, authorId, first.id, {
        clientId: "reply-1001",
        body: "Top-level response",
        parentId: null,
      });
      if (typeof root === "string") throw new Error(`Unexpected result: ${root}`);
      const child = await createDiscussionReply(db, authorId, first.id, {
        clientId: "reply-1002",
        body: "Nested reply",
        parentId: root.id,
      });
      if (typeof child === "string") throw new Error(`Unexpected result: ${child}`);
      const grandchild = await createDiscussionReply(db, authorId, first.id, {
        clientId: "reply-1003",
        body: "A reply to the nested reply",
        parentId: child.id,
      });
      if (typeof grandchild === "string") throw new Error(`Unexpected result: ${grandchild}`);

      expect(child.parentId).toBe(root.id);
      expect(grandchild.parentId).toBe(root.id);
      expect(
        await createDiscussionReply(db, authorId, second.id, {
          clientId: "reply-1004",
          body: "Wrong thread",
          parentId: root.id,
        }),
      ).toBe("not-found");
    } finally {
      await client.close();
    }
  });

  it("reserves pinning and lifecycle moderation for official users", async () => {
    const { db, client } = await createTestDb();
    try {
      const memberId = await seedUser(db, "community-member");
      const officialId = await seedUser(db, "official-account");
      await db.update(user).set({ isOfficial: true }).where(eq(user.id, officialId));
      const discussion = await createDiscussion(
        db,
        memberId,
        discussionInput("discussion-2001", "problem"),
      );

      expect(await moderateDiscussion(db, memberId, discussion.id, { pinned: true })).toBe(
        "forbidden",
      );
      const moderated = await moderateDiscussion(db, officialId, discussion.id, {
        pinned: true,
        status: "closed",
      });
      expect(moderated).toMatchObject({ pinned: true, status: "closed" });
      expect(
        await createDiscussionReply(db, memberId, discussion.id, {
          clientId: "reply-2001",
          body: "This should be rejected",
          parentId: null,
        }),
      ).toBe("closed");

      const officialDiscussion = await createDiscussion(
        db,
        officialId,
        discussionInput("discussion-2002", "feature"),
      );
      expect(officialDiscussion.author.isOfficial).toBe(true);
    } finally {
      await client.close();
    }
  });
});
