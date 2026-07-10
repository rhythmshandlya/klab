"use client";

import { icons } from "@/components/icons";
import type { LeaderboardEntry } from "@/lib/db/community-repo";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

import { Person } from "./person";

/**
 * Ranked XP table. Each row carries a thin XP bar scaled against #1 so relative
 * standing reads at a glance (single-series magnitude → one hue; the exact value is
 * printed on the row, so the bar is decorative-redundant and aria-hidden). When auth
 * is on, the session user's row is highlighted with a "You" badge — the session hook
 * only mounts when auth is enabled, mirroring AppShell's pattern.
 */
export function Leaderboard({
  entries,
  authEnabled,
}: {
  entries: readonly LeaderboardEntry[];
  authEnabled: boolean;
}) {
  if (authEnabled) return <SessionAwareBoard entries={entries} />;
  return <Board entries={entries} meId={null} signedIn={false} />;
}

function SessionAwareBoard({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const { data: session } = useSession();
  const meId = session?.user?.id ?? null;
  return <Board entries={entries} meId={meId} signedIn={Boolean(meId)} />;
}

function Board({
  entries,
  meId,
  signedIn,
}: {
  entries: readonly LeaderboardEntry[];
  meId: string | null;
  signedIn: boolean;
}) {
  const Trophy = icons.trophy;
  const Xp = icons.xp;
  const topXp = entries[0]?.xp ?? 0;
  const onBoard = meId !== null && entries.some((entry) => entry.userId === meId);

  return (
    <section aria-labelledby="leaderboard-heading">
      <div className="flex items-baseline gap-2">
        <Trophy className="text-amber size-4 self-center" aria-hidden />
        <h2 id="leaderboard-heading" className="text-foreground text-sm font-semibold">
          Leaderboard
        </h2>
        <span className="text-subtle text-xs">top {entries.length} by total XP</span>
      </div>

      {entries.length === 0 ? (
        <div className="border-border bg-panel mt-3 rounded-lg border px-4 py-8 text-center">
          <p className="text-foreground text-sm font-medium">The board is empty</p>
          <p className="text-muted mt-1 text-sm">Solve any incident lab to take #1.</p>
        </div>
      ) : (
        <>
          <ol className="border-border bg-panel divide-border mt-3 divide-y overflow-hidden rounded-lg border">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isMe = entry.userId === meId;
              const barPct = topXp > 0 ? Math.max(2, Math.round((entry.xp / topXp) * 100)) : 0;
              return (
                <li
                  key={entry.userId}
                  className={cn("relative", isMe && "bg-blue/[0.07]")}
                  aria-current={isMe ? "true" : undefined}
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "tabnums w-6 shrink-0 text-center text-sm font-semibold",
                        rank === 1 && "text-amber",
                        rank === 2 && "text-foreground",
                        rank === 3 && "text-orange-400",
                        rank > 3 && "text-subtle",
                      )}
                    >
                      {rank}
                    </span>
                    <Person
                      name={entry.name}
                      image={entry.image}
                      isAnonymous={entry.isAnonymous}
                      className="flex-1"
                    />
                    {isMe ? (
                      <span className="border-blue/30 bg-blue/10 text-blue rounded-md border px-1.5 py-0.5 text-[11px] font-medium">
                        You
                      </span>
                    ) : null}
                    <span className="text-muted hidden w-16 text-right text-xs sm:inline">
                      {entry.solves} {entry.solves === 1 ? "solve" : "solves"}
                    </span>
                    <span className="flex w-20 items-center justify-end gap-1 text-sm">
                      <Xp className="text-purple size-3.5" aria-hidden />
                      <span className="tabnums text-foreground font-medium">{entry.xp}</span>
                    </span>
                  </div>
                  <div
                    className="bg-purple/40 absolute bottom-0 left-0 h-0.5"
                    style={{ width: `${barPct}%` }}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ol>
          {signedIn && !onBoard ? (
            <p className="text-subtle mt-2 text-xs">
              You&apos;re not on the board yet — solve an incident lab to enter.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
