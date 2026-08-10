"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import { useProgress } from "@/features/progress/use-progress";
import { useSession } from "@/lib/auth/client";

/** Personal progress plus the action needed to participate publicly. */
export function RankCard({
  authEnabled,
  weeklySlug,
}: {
  authEnabled: boolean;
  weeklySlug: string;
}) {
  const progress = useProgress();
  const Xp = icons.xp;
  const Streak = icons.streak;
  const solved = progress.solvedLevelSlugs.filter((slug) =>
    LEVEL_CATALOG.some((level) => level.slug === slug),
  ).length;
  const total = LEVEL_CATALOG.length;

  return (
    <div className="border-border bg-panel flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-6 py-5">
      <Stat
        icon={<Xp className="text-purple size-5" aria-hidden />}
        value={progress.xp}
        label="XP"
      />
      <Stat
        icon={<Streak className="text-amber size-5" aria-hidden />}
        value={progress.streakDays}
        label="Day streak"
      />

      <div className="min-w-40">
        <p className="text-foreground text-lg leading-tight font-semibold">
          <span className="tabnums">{solved}</span>
          <span className="text-subtle text-sm font-normal"> of {total} problems</span>
        </p>
        <div
          className="bg-panel-elevated mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={solved}
          aria-label="Problems solved"
        >
          <div
            className="bg-green h-full rounded-full"
            style={{ width: `${total > 0 ? Math.round((solved / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="ml-auto">
        {authEnabled ? <CommunityStatus weeklySlug={weeklySlug} /> : null}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <p className="tabnums text-foreground text-lg leading-tight font-semibold">{value}</p>
        <p className="text-subtle text-xs">{label}</p>
      </div>
    </div>
  );
}

interface CommunityStatusPayload {
  publicProfile: boolean;
  solveCount: number;
  rank: { rank: number; totalRanked: number; xp: number } | null;
}

function CommunityStatus({ weeklySlug }: { weeklySlug: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<CommunityStatusPayload | null>(null);
  const [pendingJoin, setPendingJoin] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = Boolean(session?.user);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/community/rank");
      if (!response.ok) throw new Error("status unavailable");
      setPayload((await response.json()) as CommunityStatusPayload);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const timeout = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStatus, signedIn]);

  const joinCommunity = async () => {
    setPendingJoin(true);
    try {
      const response = await fetch("/api/account/privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicProfile: true }),
      });
      if (!response.ok) throw new Error("join failed");
      await loadStatus();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPendingJoin(false);
    }
  };

  if (isPending) return null;
  if (!signedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Sign in to join
        </button>
        <SignInDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => void loadStatus()}
        className="text-red text-xs hover:underline"
      >
        Retry community status
      </button>
    );
  }

  if (!payload) {
    return (
      <div className="text-right" aria-busy>
        <div className="bg-panel-elevated ml-auto h-5 w-20 animate-pulse rounded" />
        <div className="bg-panel-elevated mt-1.5 ml-auto h-3 w-28 animate-pulse rounded" />
      </div>
    );
  }

  if (!payload.publicProfile) {
    return (
      <div className="max-w-72 text-right">
        <p className="text-foreground text-sm font-medium">Your profile is private</p>
        <p className="text-subtle mt-0.5 text-xs">
          Join to show your XP and explicit publications. Private Playgrounds stay private.
        </p>
        <button
          type="button"
          onClick={() => void joinCommunity()}
          disabled={pendingJoin}
          className="text-blue mt-1.5 text-xs font-semibold hover:underline disabled:opacity-60"
        >
          {pendingJoin ? "Joining…" : "Enable community profile"}
        </button>
      </div>
    );
  }

  if (payload.solveCount === 0) {
    return (
      <div className="max-w-52 text-right">
        <p className="text-foreground text-sm font-medium">You&apos;re in</p>
        <Link
          href={`/problems/${weeklySlug}`}
          className="text-blue text-xs font-semibold hover:underline"
        >
          Complete the weekly challenge
        </Link>
      </div>
    );
  }

  if (!payload.rank) {
    return <p className="text-muted max-w-48 text-right text-sm">Your rank is being calculated.</p>;
  }

  const percentile = Math.max(1, Math.ceil((payload.rank.rank / payload.rank.totalRanked) * 100));
  return (
    <div className="text-right">
      <p className="text-foreground text-lg leading-tight font-semibold">
        Rank <span className="tabnums">#{payload.rank.rank}</span>
      </p>
      <p className="text-subtle text-xs">
        {payload.rank.totalRanked >= 10
          ? `of ${payload.rank.totalRanked} · top ${percentile}%`
          : `of ${payload.rank.totalRanked} players`}
      </p>
    </div>
  );
}
