"use client";

import { useEffect, useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import { useProgress } from "@/features/progress/use-progress";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

/**
 * "You" panel above the community lists. XP / streak / labs read from local progress
 * (identity-aware, works for guests), with a labs-completed meter against the catalog.
 * When signed in, the server rank arrives from /api/community/rank (skeleton while it
 * loads); guests get a sign-in action instead. The session hook only mounts when auth
 * is enabled, mirroring AppShell's ProgressSync pattern.
 */
export function RankCard({ authEnabled }: { authEnabled: boolean }) {
  const progress = useProgress();
  const Xp = icons.xp;
  const Streak = icons.streak;
  const solved = progress.solvedLevelSlugs.filter((slug) =>
    LEVEL_CATALOG.some((level) => level.slug === slug),
  ).length;
  const total = LEVEL_CATALOG.length;

  return (
    <div className="border-border bg-panel flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-6 py-5">
      <Stat icon={<Xp className="text-purple size-5" aria-hidden />} value={progress.xp} label="XP" />
      <Stat
        icon={<Streak className="text-amber size-5" aria-hidden />}
        value={progress.streakDays}
        label="Day streak"
      />

      <div className="min-w-40">
        <p className="text-foreground text-lg leading-tight font-semibold">
          <span className="tabnums">{solved}</span>
          <span className="text-subtle text-sm font-normal"> of {total} labs</span>
        </p>
        <div
          className="bg-panel-elevated mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={solved}
          aria-label="Incident labs solved"
        >
          <div
            className="bg-green h-full rounded-full"
            style={{ width: `${total > 0 ? Math.round((solved / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="ml-auto">{authEnabled ? <RankOrSignIn /> : null}</div>
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

  if (!payload) {
    return (
      <div className="text-right" aria-busy>
        <div className="bg-panel-elevated ml-auto h-5 w-20 animate-pulse rounded" />
        <div className="bg-panel-elevated mt-1.5 ml-auto h-3 w-28 animate-pulse rounded" />
      </div>
    );
  }

  const rank = payload.rank;
  if (!rank) {
    return <p className="text-muted max-w-48 text-right text-sm">Solve one lab to get a rank.</p>;
  }

  const percentile = Math.max(1, Math.round((rank.rank / rank.totalRanked) * 100));
  return (
    <div className="text-right">
      <p className="text-foreground text-lg leading-tight font-semibold">
        Rank <span className="tabnums">#{rank.rank}</span>
      </p>
      <p className={cn("text-subtle text-xs")}>
        {rank.totalRanked >= 10 ? `of ${rank.totalRanked} · top ${percentile}%` : `of ${rank.totalRanked} players`}
      </p>
    </div>
  );
}
