import { and, count, desc, eq, isNotNull, max, sql, sum } from "drizzle-orm";

import type { ProgressDb } from "./progress-repo";
import { progressSolved, submissions, user } from "./schema";

/**
 * Read-only community aggregates over existing tables (no schema changes):
 * leaderboard + activity feed from `progress_solved`, per-level speed records from
 * `submissions`, and the session user's rank. All queries are public-aggregate shaped;
 * the /community page caches them with ISR, and only the rank endpoint is per-user.
 *
 * Solve durations are browser-measured telemetry, not server-verified truth — the UI
 * labels records accordingly (same stance as stats-repo).
 */

export interface LeaderboardEntry {
  userId: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  xp: number;
  solves: number;
  lastSolvedAt: string;
}

export interface RecentSolve {
  name: string;
  image: string | null;
  isAnonymous: boolean;
  levelSlug: string;
  solvedAt: string;
}

export interface LevelRecord {
  levelSlug: string;
  durationMs: number;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  achievedAt: string;
}

export interface UserRank {
  rank: number;
  totalRanked: number;
  xp: number;
}

/** Top users by total XP (ties broken by solve count, then recency). */
export async function readLeaderboard(db: ProgressDb, limit: number): Promise<LeaderboardEntry[]> {
  const xp = sum(progressSolved.awardedXp).mapWith(Number);
  const solves = count(progressSolved.levelSlug);
  const lastSolvedAt = max(progressSolved.solvedAt);
  const rows = await db
    .select({
      userId: progressSolved.userId,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      xp,
      solves,
      lastSolvedAt,
    })
    .from(progressSolved)
    .innerJoin(user, eq(user.id, progressSolved.userId))
    .groupBy(progressSolved.userId, user.name, user.image, user.isAnonymous)
    .orderBy(desc(xp), desc(solves), desc(lastSolvedAt))
    .limit(limit);

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    image: row.image,
    isAnonymous: row.isAnonymous ?? false,
    xp: row.xp || 0,
    solves: Number(row.solves) || 0,
    lastSolvedAt: (row.lastSolvedAt ?? new Date(0)).toISOString(),
  }));
}

/** Latest solves across the community, newest first. */
export async function readRecentSolves(db: ProgressDb, limit: number): Promise<RecentSolve[]> {
  const rows = await db
    .select({
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      levelSlug: progressSolved.levelSlug,
      solvedAt: progressSolved.solvedAt,
    })
    .from(progressSolved)
    .innerJoin(user, eq(user.id, progressSolved.userId))
    .orderBy(desc(progressSolved.solvedAt))
    .limit(limit);

  return rows.map((row) => ({
    name: row.name,
    image: row.image,
    isAnonymous: row.isAnonymous ?? false,
    levelSlug: row.levelSlug,
    solvedAt: row.solvedAt.toISOString(),
  }));
}

/**
 * Fastest passing solve per level (browser-measured). DISTINCT ON picks exactly one
 * row per slug ordered by duration; earlier submission wins duration ties.
 */
export async function readLevelRecords(db: ProgressDb): Promise<LevelRecord[]> {
  const rows = await db
    .selectDistinctOn([submissions.levelSlug], {
      levelSlug: submissions.levelSlug,
      durationMs: submissions.durationMs,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      achievedAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(user, eq(user.id, submissions.userId))
    .where(and(eq(submissions.passed, true), isNotNull(submissions.durationMs)))
    .orderBy(submissions.levelSlug, submissions.durationMs, submissions.createdAt);

  return rows.map((row) => ({
    levelSlug: row.levelSlug,
    durationMs: row.durationMs!,
    name: row.name,
    image: row.image,
    isAnonymous: row.isAnonymous ?? false,
    achievedAt: row.achievedAt.toISOString(),
  }));
}

/**
 * The user's leaderboard position: rank by total XP among all users with at least one
 * solve (standard competition ranking — tied XP shares the higher rank). Null when the
 * user has no solves yet.
 */
export async function readUserRank(db: ProgressDb, userId: string): Promise<UserRank | null> {
  const totals = db
    .select({
      userId: progressSolved.userId,
      xp: sum(progressSolved.awardedXp).mapWith(Number).as("xp"),
    })
    .from(progressSolved)
    .groupBy(progressSolved.userId)
    .as("totals");

  const ranked = db
    .select({
      userId: totals.userId,
      xp: totals.xp,
      rank: sql<number>`rank() over (order by ${totals.xp} desc)`.as("rank"),
      totalRanked: sql<number>`count(*) over ()`.as("total_ranked"),
    })
    .from(totals)
    .as("ranked");

  const rows = await db
    .select({ rank: ranked.rank, totalRanked: ranked.totalRanked, xp: ranked.xp })
    .from(ranked)
    .where(eq(ranked.userId, userId));

  const mine = rows[0];
  if (!mine) return null;
  return {
    rank: Number(mine.rank),
    totalRanked: Number(mine.totalRanked),
    xp: mine.xp || 0,
  };
}
