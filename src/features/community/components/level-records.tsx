import Link from "next/link";

import { icons } from "@/components/icons";
import { LEVEL_CATALOG } from "@/content/levels";
import type { LevelRecord } from "@/lib/db/community-repo";

import { formatDuration } from "../format";
import { Person } from "./person";

/**
 * Fastest solve per incident lab, in catalog order. Durations are browser-measured
 * telemetry (same caveat as the catalog stats), so the section says so. Labs with no
 * timed passing solve yet render as an open challenge.
 */
export function LevelRecords({ records }: { records: readonly LevelRecord[] }) {
  const Challenge = icons.challenge;
  const Clock = icons.clock;
  const bySlug = new Map(records.map((record) => [record.levelSlug, record]));

  return (
    <section aria-labelledby="records-heading">
      <div className="flex items-center gap-2">
        <Challenge className="text-purple size-4" aria-hidden />
        <h2 id="records-heading" className="text-foreground text-sm font-semibold">
          Hall of records
        </h2>
        <span className="text-subtle text-xs">fastest solve per lab, self-timed</span>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LEVEL_CATALOG.map((level) => {
          const record = bySlug.get(level.slug);
          return (
            <li
              key={level.slug}
              className="border-border bg-panel flex flex-col gap-2 rounded-lg border px-4 py-3"
            >
              <Link
                href={`/problems/${level.slug}`}
                className="text-foreground truncate text-sm font-medium hover:underline"
              >
                {level.title}
              </Link>
              {record ? (
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
              ) : (
                <p className="text-subtle text-xs">No record yet — set the first time.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
