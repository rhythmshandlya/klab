import Link from "next/link";

import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import type { RecentSolve } from "@/lib/db/community-repo";

import { displayName, timeAgo } from "../format";
import { PersonAvatar } from "./person";

export function ActivityFeed({
  solves,
  now,
  weeklySlug,
}: {
  solves: readonly RecentSolve[];
  now: Date;
  weeklySlug: string;
}) {
  const Activity = icons.events;
  const titles = new Map(LEVEL_CATALOG.map((level) => [level.slug, level.title]));
  const visible = solves.filter((solve) => titles.has(solve.levelSlug));

  return (
    <section aria-labelledby="activity-heading">
      <div className="flex items-baseline gap-2">
        <Activity className="text-blue size-4 self-center" aria-hidden />
        <h2 id="activity-heading" className="text-foreground text-sm font-semibold">
          Latest wins
        </h2>
        <span className="text-subtle text-xs">recent public solves</span>
      </div>

      {visible.length === 0 ? (
        <div className="border-border bg-panel mt-3 rounded-lg border px-4 py-6">
          <p className="text-foreground text-sm font-medium">No public solves yet this week</p>
          <p className="text-muted mt-1 text-sm">
            Take on the challenge and start the activity feed.
          </p>
          <Link
            href={`/problems/${weeklySlug}`}
            className="text-blue mt-3 inline-block text-sm font-medium hover:underline"
          >
            Try the weekly challenge
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {visible.map((solve, i) => (
            <li
              key={`${solve.solvedAt}-${i}`}
              className="border-border bg-panel flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
            >
              <PersonAvatar
                name={solve.name}
                image={solve.image}
                isAnonymous={solve.isAnonymous}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 text-sm leading-snug">
                <span className="text-foreground font-medium">
                  {displayName(solve.name, solve.isAnonymous)}
                </span>{" "}
                <span className="text-muted">solved</span>{" "}
                <Link href={`/problems/${solve.levelSlug}`} className="text-blue hover:underline">
                  {titles.get(solve.levelSlug)}
                </Link>
                <span className="text-subtle mt-0.5 block text-xs">
                  {timeAgo(solve.solvedAt, now)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
