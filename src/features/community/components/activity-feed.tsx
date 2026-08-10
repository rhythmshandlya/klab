import Link from "next/link";

import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import type { RecentSolve } from "@/lib/db/community-repo";

import { displayName, timeAgo } from "../format";
import { PersonAvatar } from "./person";

/**
 * Recent community solves, newest first. Level titles come from the in-code catalog;
 * solves for slugs no longer in the catalog are skipped rather than shown broken.
 */
export function ActivityFeed({ solves, now }: { solves: readonly RecentSolve[]; now: Date }) {
  const Activity = icons.events;
  const titles = new Map(LEVEL_CATALOG.map((level) => [level.slug, level.title]));
  const visible = solves.filter((solve) => titles.has(solve.levelSlug));

  return (
    <section aria-labelledby="activity-heading">
      <div className="flex items-baseline gap-2">
        <Activity className="text-blue size-4 self-center" aria-hidden />
        <h2 id="activity-heading" className="text-foreground text-sm font-semibold">
          Recent activity
        </h2>
        <span className="text-subtle text-xs">latest solves</span>
      </div>

      {visible.length === 0 ? (
        <p className="border-border bg-panel text-muted mt-3 rounded-lg border px-4 py-6 text-sm">
          Quiet in here — the next solve shows up in this feed.
        </p>
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
