import type { Metadata } from "next";

import { ActivityFeed } from "@/features/community/components/activity-feed";
import { DiscussionCard } from "@/features/community/components/discussion-card";
import { DiscussionCategoryNav } from "@/features/community/components/discussion-category-nav";
import { Leaderboard } from "@/features/community/components/leaderboard";
import { NewDiscussionButton } from "@/features/community/components/new-discussion-dialog";
import { RankCard } from "@/features/community/components/rank-card";
import { WeeklyChallengeCard } from "@/features/community/components/weekly-challenge-card";
import { getWeeklyChallenge, type WeeklyChallenge } from "@/features/community/weekly-challenge";
import { isCommunityCompetitionReady } from "@/features/community/visibility";
import {
  discussionCategorySchema,
  discussionPath,
  type DiscussionCategory,
} from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import {
  readCommunityPulse,
  readRecentSolves,
  readWeeklyChallengeCompletions,
  readWeeklyLeaderboard,
  type CommunityPulse,
  type LeaderboardEntry,
  type RecentSolve,
} from "@/lib/db/community-repo";
import { readDiscussions, type DiscussionEntry } from "@/lib/db/discussions-repo";
import { isAuthConfigured } from "@/lib/env";
import { absoluteUrl, serializeJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Kubernetes Community Discussions",
  description:
    "Ask Kubernetes questions, compare debugging approaches, report KLab bugs, request features, and propose hands-on Kubernetes troubleshooting problems.",
  keywords: [
    "Kubernetes community",
    "Kubernetes discussions",
    "Kubernetes troubleshooting",
    "Kubernetes questions",
    "Kubernetes debugging",
  ],
  alternates: { canonical: "/community" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/community",
    title: "Kubernetes Community Discussions",
    description:
      "Ask Kubernetes questions, share debugging approaches, and help shape KLab features and hands-on problems.",
  },
  twitter: {
    card: "summary",
    title: "Kubernetes Community Discussions",
    description: "Questions, fixes, feature requests, and hands-on Kubernetes problem ideas.",
  },
};

export const revalidate = 30;

const LEADERBOARD_SIZE = 10;
const FEED_SIZE = 8;

interface CommunityData {
  pulse: CommunityPulse;
  leaderboard: LeaderboardEntry[];
  recentSolves: RecentSolve[];
  weeklyCompletions: number;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const now = new Date();
  const challenge = getWeeklyChallenge(now);
  const rawCategory = (await searchParams).category;
  const parsedCategory = discussionCategorySchema.safeParse(rawCategory);
  const category = parsedCategory.success ? parsedCategory.data : undefined;
  const authEnabled = isAuthConfigured();
  const [data, discussions] = await Promise.all([
    loadCommunityData(challenge),
    loadDiscussions(category),
  ]);
  const competitionReady = Boolean(data && isCommunityCompetitionReady(data.leaderboard));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Kubernetes Community Discussions",
    description:
      "Kubernetes questions, debugging discussions, product feedback, and hands-on problem ideas from the KLab community.",
    url: absoluteUrl("/community"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: (discussions ?? []).map((discussion, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(discussionPath(discussion)),
        name: discussion.title,
      })),
    },
  };

  return (
    <div
      className={cn("mx-auto w-full px-6 py-10", competitionReady ? "max-w-[1440px]" : "max-w-5xl")}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <div
        className={cn(
          "grid items-start gap-7",
          competitionReady && "xl:grid-cols-[280px_minmax(0,1fr)_300px]",
        )}
      >
        {data && competitionReady ? (
          <aside aria-label="Weekly community challenge" className="space-y-4 xl:sticky xl:top-20">
            <WeeklyChallengeCard challenge={challenge} completions={data.weeklyCompletions} />
            <RankCard authEnabled={authEnabled} weeklySlug={challenge.level.slug} />
          </aside>
        ) : null}

        <section
          aria-labelledby="community-discussions-heading"
          className={cn(competitionReady && "xl:col-start-2 xl:row-start-1")}
        >
          <header className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-blue text-[11px] font-semibold tracking-[0.12em] uppercase">
                Kubernetes community
              </p>
              <h1
                id="community-discussions-heading"
                className="text-foreground mt-1 text-3xl font-semibold tracking-tight"
              >
                Kubernetes discussions
              </h1>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Ask questions, compare debugging approaches, report product bugs, request features,
                and suggest future hands-on incidents.
              </p>
            </div>
            <NewDiscussionButton authEnabled={authEnabled} />
          </header>

          <div className="mt-8">
            <DiscussionCategoryNav active={category} />
          </div>

          {discussions === null ? (
            <div className="border-border bg-panel mt-6 rounded-xl border px-5 py-8 text-center">
              <p className="text-foreground text-sm font-medium">
                Discussions are temporarily offline
              </p>
              <p className="text-muted mt-1 text-sm">
                The community database could not be reached.
              </p>
            </div>
          ) : discussions.length === 0 ? (
            <div className="border-border bg-panel mt-6 rounded-xl border px-5 py-10 text-center">
              <p className="text-foreground text-sm font-medium">
                {category ? `No ${category} discussions yet` : "No discussions yet"}
              </p>
            </div>
          ) : (
            <ol className="mt-6 space-y-3">
              {discussions.map((discussion) => (
                <li key={discussion.id}>
                  <DiscussionCard discussion={discussion} now={now} />
                </li>
              ))}
            </ol>
          )}
        </section>

        {data && competitionReady ? (
          <aside aria-label="Community activity" className="space-y-8 xl:sticky xl:top-20">
            <div className="border-border bg-panel flex rounded-xl border px-4 py-3">
              <PulseStat value={data.pulse.players} label="active learners" />
              <div className="bg-border mx-4 w-px" aria-hidden />
              <PulseStat value={data.pulse.solvesThisWeek} label="7-day solves" />
            </div>
            <Leaderboard
              entries={data.leaderboard}
              authEnabled={authEnabled}
              weeklySlug={challenge.level.slug}
            />
            <ActivityFeed solves={data.recentSolves} now={now} weeklySlug={challenge.level.slug} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function PulseStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="tabnums text-foreground text-lg font-semibold">{value}</p>
      <p className="text-subtle text-[11px]">{label}</p>
    </div>
  );
}

async function loadDiscussions(category?: DiscussionCategory): Promise<DiscussionEntry[] | null> {
  if (!hasDb()) return null;
  try {
    return await readDiscussions(getDb(), { category, limit: 50 });
  } catch {
    return null;
  }
}

async function loadCommunityData(challenge: WeeklyChallenge): Promise<CommunityData | null> {
  if (!hasDb()) return null;
  try {
    const db = getDb();
    const [pulse, leaderboard] = await Promise.all([
      readCommunityPulse(db),
      readWeeklyLeaderboard(db, challenge.startsAt, challenge.endsAt, LEADERBOARD_SIZE),
    ]);
    if (!isCommunityCompetitionReady(leaderboard)) {
      return { pulse, leaderboard, recentSolves: [], weeklyCompletions: 0 };
    }
    const [recentSolves, weeklyCompletions] = await Promise.all([
      readRecentSolves(db, FEED_SIZE),
      readWeeklyChallengeCompletions(
        db,
        challenge.level.slug,
        challenge.startsAt,
        challenge.endsAt,
      ),
    ]);
    return { pulse, leaderboard, recentSolves, weeklyCompletions };
  } catch {
    return null;
  }
}
