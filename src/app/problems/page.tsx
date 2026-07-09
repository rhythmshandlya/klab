import type { Metadata } from "next";

import { LEVEL_CATALOG, type LevelSummary } from "@/content/levels";
import { getDb, hasDb } from "@/lib/db";
import { readLevelStats } from "@/lib/db/stats-repo";
import { ProblemsDashboard } from "@/features/problems/components/problems-dashboard";

export const metadata: Metadata = { title: "Problems" };

// Revalidate the (public, aggregate) stats hourly; the catalog itself is static code.
export const revalidate = 3600;

/** Show real numbers only once a problem has enough attempts; otherwise keep the author's estimate. */
const MIN_SAMPLE = 20;

/**
 * Server component. The catalog is static code; when a database is configured we
 * overlay REAL success rate + avg solve time (from the submissions history) onto each
 * entry, falling back to the authored estimate below a minimum sample or when there's
 * no DB (guest/static build). The read is wrapped so a DB error never breaks the page.
 */
export default async function ProblemsPage() {
  const catalog = await buildCatalog();
  return <ProblemsDashboard catalog={catalog} />;
}

async function buildCatalog(): Promise<LevelSummary[]> {
  if (!hasDb()) return [...LEVEL_CATALOG];
  try {
    const stats = await readLevelStats(getDb());
    return LEVEL_CATALOG.map((level) => {
      const stat = stats[level.slug];
      if (!stat || stat.sampleSize < MIN_SAMPLE) return { ...level };
      return {
        ...level,
        successRate: Math.round(stat.successRate * 100),
        estimatedMinutes: stat.avgSolveMs
          ? Math.max(1, Math.round(stat.avgSolveMs / 60000))
          : level.estimatedMinutes,
      };
    });
  } catch {
    // DB unreachable / not migrated — fall back to the authored catalog.
    return [...LEVEL_CATALOG];
  }
}
