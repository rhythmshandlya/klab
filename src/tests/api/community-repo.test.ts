import { describe, expect, it } from "vitest";

import {
  readCommunityPulse,
  readLeaderboard,
  readLevelRecords,
  readRecentSolves,
  readUserCommunityStatus,
  readUserRank,
  readWeeklyChallengeCompletions,
  readWeeklyLeaderboard,
} from "@/lib/db/community-repo";
import { progressSolved, submissions, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { createTestDb, seedUser, type TestDb } from "./pglite";

/**
 * community-repo is read-only aggregation, so fixtures are inserted directly (explicit
 * XP and timestamps) rather than going through applyIntents: ordering assertions need
 * deterministic values.
 */

const at = (iso: string) => new Date(iso);

async function seedSolve(
  db: TestDb,
  userId: string,
  levelSlug: string,
  awardedXp: number,
  solvedAt: Date,
) {
  await db.insert(progressSolved).values({
    userId,
    levelSlug,
    awardedXp,
    solvedDay: solvedAt.toISOString().slice(0, 10),
    solvedAt,
  });
}

describe("community-repo over pglite", () => {
  it("ranks the leaderboard by total XP with solve counts", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      const c = await seedUser(db, "userC");

      await seedSolve(db, a, "level-1", 100, at("2026-07-01T10:00:00Z"));
      await seedSolve(db, a, "level-2", 50, at("2026-07-02T10:00:00Z"));
      await seedSolve(db, b, "level-1", 200, at("2026-07-03T10:00:00Z"));
      await seedSolve(db, c, "level-3", 150, at("2026-07-04T10:00:00Z"));

      const board = await readLeaderboard(db, 10);

      expect(board.map((e) => e.userId)).toEqual([b, a, c]);
      expect(board[0]).toMatchObject({ xp: 200, solves: 1 });
      expect(board[1]).toMatchObject({ xp: 150, solves: 2 });
      expect(board[2]).toMatchObject({ xp: 150, solves: 1 });
    } finally {
      await client.close();
    }
  });

  it("respects the leaderboard limit", async () => {
    const { db, client } = await createTestDb();
    try {
      for (let i = 0; i < 3; i++) {
        const id = await seedUser(db, `user${i}`);
        await seedSolve(db, id, "level-1", 10 * (i + 1), at("2026-07-01T10:00:00Z"));
      }
      expect(await readLeaderboard(db, 2)).toHaveLength(2);
    } finally {
      await client.close();
    }
  });

  it("excludes private accounts from every public community surface", async () => {
    const { db, client } = await createTestDb();
    try {
      const visible = await seedUser(db, "visible");
      const privateUser = await seedUser(db, "private");
      await db.update(user).set({ publicProfile: false }).where(eq(user.id, privateUser));
      await seedSolve(db, visible, "level-1", 10, new Date());
      await seedSolve(db, privateUser, "level-2", 1_000, new Date());

      expect((await readLeaderboard(db, 10)).map((entry) => entry.userId)).toEqual([visible]);
      expect((await readRecentSolves(db, 10)).map((entry) => entry.levelSlug)).toEqual(["level-1"]);
      expect(await readCommunityPulse(db)).toMatchObject({ players: 1 });
      expect(await readUserRank(db, privateUser)).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("lists recent solves newest first", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");

      await seedSolve(db, a, "level-old", 10, at("2026-07-01T10:00:00Z"));
      await seedSolve(db, b, "level-mid", 10, at("2026-07-02T10:00:00Z"));
      await seedSolve(db, a, "level-new", 10, at("2026-07-03T10:00:00Z"));

      const feed = await readRecentSolves(db, 2);

      expect(feed.map((s) => s.levelSlug)).toEqual(["level-new", "level-mid"]);
      expect(feed[0]!.solvedAt).toBe("2026-07-03T10:00:00.000Z");
    } finally {
      await client.close();
    }
  });

  it("keeps only the fastest passing timed solve per level", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");

      await db.insert(submissions).values([
        // level-1: B (30s) beats A (60s); a faster FAILED run and an untimed pass are ignored.
        {
          userId: a,
          levelSlug: "level-1",
          passed: true,
          checksTotal: 3,
          checksPassed: 3,
          durationMs: 60_000,
          clientMutationId: "community-submission-0001",
        },
        {
          userId: b,
          levelSlug: "level-1",
          passed: true,
          checksTotal: 3,
          checksPassed: 3,
          durationMs: 30_000,
          clientMutationId: "community-submission-0002",
        },
        {
          userId: a,
          levelSlug: "level-1",
          passed: false,
          checksTotal: 3,
          checksPassed: 1,
          durationMs: 5_000,
          clientMutationId: "community-submission-0003",
        },
        {
          userId: a,
          levelSlug: "level-1",
          passed: true,
          checksTotal: 3,
          checksPassed: 3,
          durationMs: null,
          clientMutationId: "community-submission-0004",
        },
        // level-2: only an untimed pass → no record.
        {
          userId: a,
          levelSlug: "level-2",
          passed: true,
          checksTotal: 3,
          checksPassed: 3,
          durationMs: null,
          clientMutationId: "community-submission-0005",
        },
      ]);

      const records = await readLevelRecords(db);

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ levelSlug: "level-1", durationMs: 30_000 });
    } finally {
      await client.close();
    }
  });

  it("counts distinct players and this week's solves in the pulse", async () => {
    const { db, client } = await createTestDb();
    try {
      expect(await readCommunityPulse(db)).toEqual({ players: 0, solvesThisWeek: 0 });

      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      const now = new Date();
      const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

      await seedSolve(db, a, "level-1", 10, daysAgo(1));
      await seedSolve(db, a, "level-2", 10, daysAgo(30));
      await seedSolve(db, b, "level-1", 10, daysAgo(2));

      expect(await readCommunityPulse(db)).toEqual({ players: 2, solvesThisWeek: 2 });
    } finally {
      await client.close();
    }
  });

  it("computes competition rank and cohort size; null with no solves", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      const c = await seedUser(db, "userC");
      const d = await seedUser(db, "userD");

      await seedSolve(db, a, "level-1", 300, at("2026-07-01T10:00:00Z"));
      await seedSolve(db, b, "level-1", 100, at("2026-07-01T11:00:00Z"));
      await seedSolve(db, c, "level-2", 100, at("2026-07-01T12:00:00Z"));

      expect(await readUserRank(db, a)).toEqual({ rank: 1, totalRanked: 3, xp: 300 });
      // B and C tie on 100 XP → both rank 2 (competition ranking).
      expect(await readUserRank(db, b)).toEqual({ rank: 2, totalRanked: 3, xp: 100 });
      expect(await readUserRank(db, c)).toEqual({ rank: 2, totalRanked: 3, xp: 100 });
      expect(await readUserRank(db, d)).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("scopes the weekly leaderboard and challenge completions to the UTC window", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "weeklyA");
      const b = await seedUser(db, "weeklyB");
      const start = at("2026-08-10T00:00:00Z");
      const end = at("2026-08-17T00:00:00Z");

      await seedSolve(db, a, "weekly-problem", 100, at("2026-08-10T10:00:00Z"));
      await seedSolve(db, b, "other-problem", 250, at("2026-08-16T10:00:00Z"));
      await seedSolve(db, a, "old-problem", 1_000, at("2026-08-09T23:59:00Z"));

      expect(
        (await readWeeklyLeaderboard(db, start, end, 10)).map((entry) => entry.userId),
      ).toEqual([b, a]);
      expect(await readWeeklyChallengeCompletions(db, "weekly-problem", start, end)).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("returns private users' progress without exposing a public rank", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db, "private-status");
      await seedSolve(db, userId, "level-1", 100, at("2026-08-10T10:00:00Z"));
      await db.update(user).set({ publicProfile: false }).where(eq(user.id, userId));

      expect(await readUserCommunityStatus(db, userId)).toEqual({
        publicProfile: false,
        solveCount: 1,
        rank: null,
      });
    } finally {
      await client.close();
    }
  });
});
