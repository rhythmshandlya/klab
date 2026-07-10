import { icons } from "@/components/icons";
import type { LeaderboardEntry } from "@/lib/db/community-repo";
import { cn } from "@/lib/utils/cn";

import { Person } from "./person";

/**
 * Ranked XP table (server-rendered from the ISR-cached query). Top three get medal
 * tones; the rank number is always present so color is never the only signal.
 */
export function Leaderboard({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const Trophy = icons.trophy;
  const Xp = icons.xp;

  return (
    <section aria-labelledby="leaderboard-heading">
      <div className="flex items-center gap-2">
        <Trophy className="text-amber size-4" aria-hidden />
        <h2 id="leaderboard-heading" className="text-foreground text-sm font-semibold">
          Leaderboard
        </h2>
        <span className="text-subtle text-xs">by total XP</span>
      </div>

      {entries.length === 0 ? (
        <p className="border-border bg-panel text-muted mt-3 rounded-lg border px-4 py-6 text-sm">
          No solves on the board yet — sign in and solve an incident to claim the top spot.
        </p>
      ) : (
        <ol className="border-border bg-panel mt-3 divide-border divide-y overflow-hidden rounded-lg border">
          {entries.map((entry, i) => {
            const rank = i + 1;
            return (
              <li key={entry.userId} className="flex items-center gap-3 px-4 py-2.5">
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
                <span className="text-muted hidden w-16 text-right text-xs sm:inline">
                  {entry.solves} {entry.solves === 1 ? "solve" : "solves"}
                </span>
                <span className="text-purple flex w-20 items-center justify-end gap-1 text-sm font-medium">
                  <Xp className="size-3.5" aria-hidden />
                  <span className="tabnums">{entry.xp}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
