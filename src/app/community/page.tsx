import type { Metadata } from "next";
import Link from "next/link";

import { icons } from "@/components/icons";
import { ActivityFeed } from "@/features/community/components/activity-feed";
import { Leaderboard } from "@/features/community/components/leaderboard";
import { LevelRecords } from "@/features/community/components/level-records";
import { PublicPlaygrounds } from "@/features/community/components/public-playgrounds";
import { RankCard } from "@/features/community/components/rank-card";
import { WeeklyChallengeCard } from "@/features/community/components/weekly-challenge-card";
import { getWeeklyChallenge, type WeeklyChallenge } from "@/features/community/weekly-challenge";
import { getDb, hasDb } from "@/lib/db";
import {
  readCommunityPulse,
  readLevelRecords,
  readPublicPlaygrounds,
  readRecentSolves,
  readWeeklyChallengeCompletions,
  readWeeklyLeaderboard,
  type CommunityPulse,
  type LeaderboardEntry,
  type LevelRecord,
  type PublicPlaygroundEntry,
  type RecentSolve,
} from "@/lib/db/community-repo";
import { isAuthConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Community",
  description: "Weekly Kubernetes challenges and reproducible Playgrounds shared by KLab users.",
};

export const revalidate = 60;

const LEADERBOARD_SIZE = 10;
const FEED_SIZE = 12;
const PUBLIC_PLAYGROUND_SIZE = 6;

interface CommunityData {
  pulse: CommunityPulse;
  leaderboard: LeaderboardEntry[];
  recentSolves: RecentSolve[];
  records: LevelRecord[];
  publicPlaygrounds: PublicPlaygroundEntry[];
  weeklyCompletions: number;
}

export default async function CommunityPage() {
  const now = new Date();
  const challenge = getWeeklyChallenge(now);
  const authEnabled = isAuthConfigured();
  const data = await loadCommunityData(challenge);
  const Arrow = icons.arrowRight;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-blue text-[11px] font-semibold tracking-[0.12em] uppercase">
            Learn, build, share
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">
            Learn Kubernetes together
          </h1>
          <p className="text-muted mt-3 text-[15px] leading-relaxed">
            Solve the weekly incident, compare progress, and fork reproducible Kubernetes setups
            shared by the community.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/problems/${challenge.level.slug}`}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
            >
              Take this week&apos;s challenge
              <Arrow className="size-4" aria-hidden />
            </Link>
            <Link
              href="/playground"
              className="border-border bg-panel text-foreground hover:bg-panel-hover inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors"
            >
              Open Playground
            </Link>
          </div>
        </div>
        {data && data.pulse.players > 0 ? (
          <div className="border-border bg-panel flex rounded-xl border px-5 py-3">
            <PulseStat value={data.pulse.players} label="community members" />
            <div className="bg-border mx-5 w-px" aria-hidden />
            <PulseStat value={data.pulse.solvesThisWeek} label="solves in 7 days" />
          </div>
        ) : null}
      </header>

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <WeeklyChallengeCard challenge={challenge} completions={data?.weeklyCompletions ?? 0} />
        <RankCard authEnabled={authEnabled} weeklySlug={challenge.level.slug} />
      </div>

      <div className="mt-12">
        <PublicPlaygrounds
          entries={data?.publicPlaygrounds ?? []}
          authEnabled={authEnabled}
          now={now.toISOString()}
        />
      </div>

      {data ? (
        <>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
            <Leaderboard
              entries={data.leaderboard}
              authEnabled={authEnabled}
              weeklySlug={challenge.level.slug}
            />
            <ActivityFeed solves={data.recentSolves} now={now} weeklySlug={challenge.level.slug} />
          </div>
          {data.records.length >= 3 ? (
            <div className="mt-12">
              <LevelRecords records={data.records} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="border-border bg-panel mt-10 rounded-xl border px-5 py-4">
          <p className="text-foreground text-sm font-medium">
            Community activity is temporarily offline
          </p>
          <p className="text-muted mt-1 text-sm">
            The weekly challenge and official Playground starters are still available. Public
            activity will return when the database reconnects.
          </p>
        </div>
      )}
    </div>
  );
}

function PulseStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="tabnums text-foreground text-lg font-semibold">{value}</p>
      <p className="text-subtle text-xs">{label}</p>
    </div>
  );
}

async function loadCommunityData(challenge: WeeklyChallenge): Promise<CommunityData | null> {
  if (!hasDb()) return null;
  try {
    const db = getDb();
    const [pulse, leaderboard, recentSolves, records, publicPlaygrounds, weeklyCompletions] =
      await Promise.all([
        readCommunityPulse(db),
        readWeeklyLeaderboard(db, challenge.startsAt, challenge.endsAt, LEADERBOARD_SIZE),
        readRecentSolves(db, FEED_SIZE),
        readLevelRecords(db),
        readPublicPlaygrounds(db, PUBLIC_PLAYGROUND_SIZE),
        readWeeklyChallengeCompletions(
          db,
          challenge.level.slug,
          challenge.startsAt,
          challenge.endsAt,
        ),
      ]);
    return {
      pulse,
      leaderboard,
      recentSolves,
      records,
      publicPlaygrounds,
      weeklyCompletions,
    };
  } catch {
    return null;
  }
}
