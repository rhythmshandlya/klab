"use client";

import { useEffect, useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import { useProgress } from "@/features/progress/use-progress";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

/**
 * "You" panel above the community lists. XP / streak / solves read from local progress
 * (identity-aware, works for guests). When signed in, it also fetches the server rank
 * from /api/community/rank; guests get a sign-in nudge instead. The session hook only
 * mounts when auth is enabled, mirroring AppShell's ProgressSync pattern.
 */
export function RankCard({ authEnabled }: { authEnabled: boolean }) {
  const progress = useProgress();
  const Xp = icons.xp;
  const Streak = icons.streak;
  const Trophy = icons.trophy;

  const stats = [
    { label: "XP", value: progress.xp, icon: Xp, tone: "text-purple" },
    { label: "Day streak", value: progress.streakDays, icon: Streak, tone: "text-amber" },
    { label: "Solved", value: progress.solvedLevelSlugs.length, icon: Trophy, tone: "text-green" },
  ];

  return (
    <div className="border-border bg-panel flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-6 py-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <s.icon className={cn("size-5", s.tone)} aria-hidden />
            <div>
              <p className="tabnums text-foreground text-lg leading-tight font-semibold">
                {s.value}
              </p>
              <p className="text-subtle text-xs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="ml-auto">
        {authEnabled ? <RankOrSignIn /> : null}
      </div>
    </div>
  );
}

interface RankPayload {
  rank: { rank: number; totalRanked: number; xp: number } | null;
}

function RankOrSignIn() {
  const { data: session, isPending } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<RankPayload | null>(null);
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void fetch("/api/community/rank")
      .then((res) => (res.ok ? (res.json() as Promise<RankPayload>) : null))
      .then((data) => {
        if (!cancelled && data) setPayload(data);
      })
      .catch(() => {
        // Rank is decoration — the local stats already rendered.
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (isPending) return null;

  if (!signedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Sign in to join the leaderboard
        </button>
        <SignInDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const rank = payload?.rank;
  if (payload && !rank) {
    return <p className="text-muted text-sm">Solve an incident to enter the leaderboard.</p>;
  }
  if (!rank) return null;

  const percentile = Math.max(1, Math.round((rank.rank / rank.totalRanked) * 100));
  return (
    <div className="text-right">
      <p className="text-foreground text-lg leading-tight font-semibold">
        Rank <span className="tabnums">#{rank.rank}</span>
      </p>
      <p className="text-subtle text-xs">
        of {rank.totalRanked} · top {percentile}%
      </p>
    </div>
  );
}
