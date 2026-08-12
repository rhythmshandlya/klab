import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  type CreateDiscussionInput,
  type CreateDiscussionReplyInput,
  type DiscussionCategory,
  type DiscussionStatus,
  type ModerateDiscussionInput,
} from "@/lib/community/contracts";

import type { ProgressDb } from "./progress-repo";
import { communityDiscussionReplies, communityDiscussions, user } from "./schema";

export interface DiscussionAuthor {
  id: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  isOfficial: boolean;
}

export interface DiscussionEntry {
  id: string;
  title: string;
  body: string;
  category: DiscussionCategory;
  status: DiscussionStatus;
  pinned: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  author: DiscussionAuthor;
}

export interface DiscussionReplyEntry {
  id: string;
  discussionId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: DiscussionAuthor;
}

export interface DiscussionThread {
  discussion: DiscussionEntry;
  replies: DiscussionReplyEntry[];
}

const discussionSelection = {
  id: communityDiscussions.id,
  title: communityDiscussions.title,
  body: communityDiscussions.body,
  category: communityDiscussions.category,
  status: communityDiscussions.status,
  pinned: communityDiscussions.pinned,
  replyCount:
    sql<number>`(select count(*) from ${communityDiscussionReplies} where ${communityDiscussionReplies.discussionId} = ${communityDiscussions.id})`.mapWith(
      Number,
    ),
  lastActivityAt: communityDiscussions.lastActivityAt,
  createdAt: communityDiscussions.createdAt,
  updatedAt: communityDiscussions.updatedAt,
  authorId: user.id,
  authorName: user.name,
  authorImage: user.image,
  authorAnonymous: user.isAnonymous,
  authorOfficial: user.isOfficial,
};

type SelectedDiscussion = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  pinned: boolean;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  authorAnonymous: boolean | null;
  authorOfficial: boolean;
};

function mapDiscussion(row: SelectedDiscussion): DiscussionEntry {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as DiscussionCategory,
    status: row.status as DiscussionStatus,
    pinned: row.pinned,
    replyCount: row.replyCount,
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: {
      id: row.authorId,
      name: row.authorName,
      image: row.authorImage,
      isAnonymous: row.authorAnonymous ?? false,
      isOfficial: row.authorOfficial,
    },
  };
}

export async function readDiscussions(
  db: ProgressDb,
  options: { category?: DiscussionCategory; limit: number },
): Promise<DiscussionEntry[]> {
  const rows = await db
    .select(discussionSelection)
    .from(communityDiscussions)
    .innerJoin(user, eq(user.id, communityDiscussions.authorId))
    .where(options.category ? eq(communityDiscussions.category, options.category) : undefined)
    .orderBy(desc(communityDiscussions.pinned), desc(communityDiscussions.lastActivityAt))
    .limit(options.limit);
  return rows.map((row) => mapDiscussion(row as SelectedDiscussion));
}

async function readDiscussionEntry(
  db: ProgressDb,
  discussionId: string,
): Promise<DiscussionEntry | null> {
  const rows = await db
    .select(discussionSelection)
    .from(communityDiscussions)
    .innerJoin(user, eq(user.id, communityDiscussions.authorId))
    .where(eq(communityDiscussions.id, discussionId))
    .limit(1);
  return rows[0] ? mapDiscussion(rows[0] as SelectedDiscussion) : null;
}

export async function readDiscussion(
  db: ProgressDb,
  discussionId: string,
): Promise<DiscussionThread | null> {
  const discussion = await readDiscussionEntry(db, discussionId);
  if (!discussion) return null;
  const rows = await db
    .select({
      id: communityDiscussionReplies.id,
      discussionId: communityDiscussionReplies.discussionId,
      parentId: communityDiscussionReplies.parentId,
      body: communityDiscussionReplies.body,
      createdAt: communityDiscussionReplies.createdAt,
      updatedAt: communityDiscussionReplies.updatedAt,
      authorId: user.id,
      authorName: user.name,
      authorImage: user.image,
      authorAnonymous: user.isAnonymous,
      authorOfficial: user.isOfficial,
    })
    .from(communityDiscussionReplies)
    .innerJoin(user, eq(user.id, communityDiscussionReplies.authorId))
    .where(eq(communityDiscussionReplies.discussionId, discussionId))
    .orderBy(asc(communityDiscussionReplies.createdAt));

  return {
    discussion,
    replies: rows.map((row) => ({
      id: row.id,
      discussionId: row.discussionId,
      parentId: row.parentId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: {
        id: row.authorId,
        name: row.authorName,
        image: row.authorImage,
        isAnonymous: row.authorAnonymous ?? false,
        isOfficial: row.authorOfficial,
      },
    })),
  };
}

export async function createDiscussion(
  db: ProgressDb,
  authorId: string,
  input: CreateDiscussionInput,
): Promise<DiscussionEntry> {
  const now = new Date();
  const inserted = await db
    .insert(communityDiscussions)
    .values({
      authorId,
      clientId: input.clientId,
      category: input.category,
      title: input.title,
      body: input.body,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [communityDiscussions.authorId, communityDiscussions.clientId],
    })
    .returning({ id: communityDiscussions.id });

  const discussionId =
    inserted[0]?.id ??
    (
      await db
        .select({ id: communityDiscussions.id })
        .from(communityDiscussions)
        .where(
          and(
            eq(communityDiscussions.authorId, authorId),
            eq(communityDiscussions.clientId, input.clientId),
          ),
        )
        .limit(1)
    )[0]?.id;
  if (!discussionId) throw new Error("Discussion insert did not return an id.");
  const discussion = await readDiscussionEntry(db, discussionId);
  if (!discussion) throw new Error("Discussion could not be read after creation.");
  return discussion;
}

export async function createDiscussionReply(
  db: ProgressDb,
  authorId: string,
  discussionId: string,
  input: CreateDiscussionReplyInput,
): Promise<DiscussionReplyEntry | "not-found" | "closed"> {
  const discussions = await db
    .select({ id: communityDiscussions.id, status: communityDiscussions.status })
    .from(communityDiscussions)
    .where(eq(communityDiscussions.id, discussionId))
    .limit(1);
  if (!discussions[0]) return "not-found";
  if (discussions[0].status === "closed") return "closed";

  let parentId: string | null = null;
  if (input.parentId) {
    const parents = await db
      .select({
        id: communityDiscussionReplies.id,
        parentId: communityDiscussionReplies.parentId,
      })
      .from(communityDiscussionReplies)
      .where(
        and(
          eq(communityDiscussionReplies.id, input.parentId),
          eq(communityDiscussionReplies.discussionId, discussionId),
        ),
      )
      .limit(1);
    const parent = parents[0];
    if (!parent) return "not-found";
    parentId = parent.parentId ?? parent.id;
  }

  const now = new Date();
  const inserted = await db
    .insert(communityDiscussionReplies)
    .values({
      discussionId,
      authorId,
      clientId: input.clientId,
      parentId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [communityDiscussionReplies.authorId, communityDiscussionReplies.clientId],
    })
    .returning({ id: communityDiscussionReplies.id });

  const replyId =
    inserted[0]?.id ??
    (
      await db
        .select({
          id: communityDiscussionReplies.id,
          discussionId: communityDiscussionReplies.discussionId,
        })
        .from(communityDiscussionReplies)
        .where(
          and(
            eq(communityDiscussionReplies.authorId, authorId),
            eq(communityDiscussionReplies.clientId, input.clientId),
          ),
        )
        .limit(1)
    )[0]?.id;
  if (!replyId) throw new Error("Reply insert did not return an id.");

  if (inserted[0]) {
    await db
      .update(communityDiscussions)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(communityDiscussions.id, discussionId));
  }

  const rows = await db
    .select({
      id: communityDiscussionReplies.id,
      discussionId: communityDiscussionReplies.discussionId,
      parentId: communityDiscussionReplies.parentId,
      body: communityDiscussionReplies.body,
      createdAt: communityDiscussionReplies.createdAt,
      updatedAt: communityDiscussionReplies.updatedAt,
      authorId: user.id,
      authorName: user.name,
      authorImage: user.image,
      authorAnonymous: user.isAnonymous,
      authorOfficial: user.isOfficial,
    })
    .from(communityDiscussionReplies)
    .innerJoin(user, eq(user.id, communityDiscussionReplies.authorId))
    .where(
      and(
        eq(communityDiscussionReplies.id, replyId),
        eq(communityDiscussionReplies.discussionId, discussionId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        id: row.id,
        discussionId: row.discussionId,
        parentId: row.parentId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        author: {
          id: row.authorId,
          name: row.authorName,
          image: row.authorImage,
          isAnonymous: row.authorAnonymous ?? false,
          isOfficial: row.authorOfficial,
        },
      }
    : "not-found";
}

export async function isOfficialUser(db: ProgressDb, userId: string): Promise<boolean> {
  const rows = await db
    .select({ isOfficial: user.isOfficial })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0]?.isOfficial ?? false;
}

export async function moderateDiscussion(
  db: ProgressDb,
  actorId: string,
  discussionId: string,
  input: ModerateDiscussionInput,
): Promise<DiscussionEntry | "forbidden" | null> {
  if (!(await isOfficialUser(db, actorId))) return "forbidden";
  const rows = await db
    .update(communityDiscussions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(communityDiscussions.id, discussionId))
    .returning({ id: communityDiscussions.id });
  if (!rows[0]) return null;
  return readDiscussionEntry(db, discussionId);
}
