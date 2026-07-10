import type { Metadata } from "next";

import { ActivityFeed } from "@/features/community/components/activity-feed";
import { Leaderboard } from "@/features/community/components/leaderboard";
import { LevelRecords } from "@/features/community/components/level-records";
import { RankCard } from "@/features/community/components/rank-card";
import { getDb, hasDb } from "@/lib/db";
import {
  readCommunityPulse,
  readLeaderboard,
  readLevelRecords,
  readRecentSolves,
  type CommunityPulse,
  type LeaderboardEntry,
  type LevelRecord,
  type RecentSolve,
} from "@/lib/db/community-repo";
import { isAuthConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Community" };

// Public aggregates are shared by every visitor; a minute of staleness is fine for a
// feed and keeps the page a single cached render (no per-view DB load).
export const revalidate = 60;

const LEADERBOARD_SIZE = 50;
const FEED_SIZE = 20;

interface CommunityData {
  pulse: CommunityPulse;
  leaderboard: LeaderboardEntry[];
  recentSolves: RecentSolve[];
  records: LevelRecord[];
}

/**
 * Server component. Leaderboard, activity feed, and per-level records come from
 * ISR-cached aggregate queries; the personal rank card and the leaderboard's
 * self-highlight are the only client pieces. Without a database (guest-only deploys)
 * the community sections show one honest empty state and the rank card still works
 * from localStorage.
 */
export default async function CommunityPage() {
  const authEnabled = isAuthConfigured();
  const data = await loadCommunityData();
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
            The klab community
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
            Community
          </h1>
        </div>
        {data && data.pulse.players > 0 ? (
          <p className="text-muted pb-1 text-sm">
            <span className="tabnums text-foreground font-medium">{data.pulse.players}</span>{" "}
            {data.pulse.players === 1 ? "player" : "players"}
            <span className="text-subtle mx-2">·</span>
            <span className="tabnums text-foreground font-medium">
              {data.pulse.solvesThisWeek}
            </span>{" "}
            {data.pulse.solvesThisWeek === 1 ? "solve" : "solves"} this week
          </p>
        ) : null}
      </div>
      <p className="text-muted mt-2 max-w-2xl text-[15px] leading-relaxed">
        See how you stack up — XP leaderboard, live solve activity, and the fastest recorded
        time for every incident lab.
      </p>

      <div className="mt-8">
        <RankCard authEnabled={authEnabled} />
      </div>

      {data ? (
        <>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
            <Leaderboard entries={data.leaderboard} authEnabled={authEnabled} />
            <ActivityFeed solves={data.recentSolves} now={new Date()} />
          </div>
          <div className="mt-10">
            <LevelRecords records={data.records} />
          </div>
        </>
      ) : (
        <div className="border-border bg-panel mt-10 rounded-xl border px-6 py-10 text-center">
          <p className="text-foreground text-sm font-medium">Community stats are offline</p>
          <p className="text-muted mx-auto mt-1 max-w-md text-sm">
            This deployment has no server database, so the leaderboard, activity feed, and
            records can&apos;t be shown. Your own progress above still tracks locally.
          </p>
        </div>
      )}
    </div>
  );
}

async function loadCommunityData(): Promise<CommunityData | null> {
  if (!hasDb()) return null;
  try {
    const db = getDb();
    const [pulse, leaderboard, recentSolves, records] = await Promise.all([
      readCommunityPulse(db),
      readLeaderboard(db, LEADERBOARD_SIZE),
      readRecentSolves(db, FEED_SIZE),
      readLevelRecords(db),
    ]);
    return { pulse, leaderboard, recentSolves, records };
  } catch {
    // DB unreachable / not migrated — degrade to the offline state.
    return null;
  }
}
