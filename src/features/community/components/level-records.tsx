import Link from "next/link";

import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import type { LevelRecord } from "@/lib/db/community-repo";

import { formatDuration } from "../format";
import { Person } from "./person";

/**
 * Fastest solve per incident lab, in catalog order. Durations are browser-measured
 * telemetry (same caveat as the catalog stats), so the heading says so. Labs with a
 * record get a full card; unclaimed labs collapse into one "open challenges" strip —
 * an invitation to set the first time, not a grid of empty cards.
 */
export function LevelRecords({ records }: { records: readonly LevelRecord[] }) {
  const Challenge = icons.challenge;
  const Clock = icons.clock;
  const bySlug = new Map(records.map((record) => [record.levelSlug, record]));
  const claimed = LEVEL_CATALOG.filter((level) => bySlug.has(level.slug));
  const open = LEVEL_CATALOG.filter((level) => !bySlug.has(level.slug));

  return (
    <section aria-labelledby="records-heading">
      <div className="flex items-baseline gap-2">
        <Challenge className="text-purple size-4 self-center" aria-hidden />
        <h2 id="records-heading" className="text-foreground text-sm font-semibold">
          Community bests
        </h2>
        <span className="text-subtle text-xs">informal, browser-timed records</span>
      </div>

      {claimed.length > 0 ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {claimed.map((level) => {
            const record = bySlug.get(level.slug)!;
            return (
              <li
                key={level.slug}
                className="border-border bg-panel flex flex-col gap-2 rounded-lg border px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/problems/${level.slug}`}
                    className="text-foreground truncate text-sm font-medium hover:underline"
                  >
                    {level.title}
                  </Link>
                  <span className="text-subtle shrink-0 text-xs capitalize">
                    {level.difficulty}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Person
                    name={record.name}
                    image={record.image}
                    isAnonymous={record.isAnonymous}
                  />
                  <span className="text-green flex shrink-0 items-center gap-1 text-sm font-medium">
                    <Clock className="size-3.5" aria-hidden />
                    <span className="tabnums">{formatDuration(record.durationMs)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-border bg-panel mt-3 rounded-lg border px-4 py-8 text-center">
          <p className="text-foreground text-sm font-medium">No records yet</p>
          <p className="text-muted mt-1 text-sm">
            Every lab below is unclaimed — the first timed solve sets the record.
          </p>
        </div>
      )}

      {open.length > 0 ? (
        <div className="mt-4">
          <p className="text-subtle text-xs font-semibold tracking-[0.08em] uppercase">
            Open challenges — no record yet
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {open.map((level) => (
              <li key={level.slug}>
                <Link
                  href={`/problems/${level.slug}`}
                  className="border-border bg-panel text-muted hover:border-border-strong hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
                >
                  {level.title}
                  <span className="text-subtle capitalize">{level.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
