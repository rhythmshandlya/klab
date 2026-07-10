import { countDistinct, sql } from "drizzle-orm";

import type { ProgressDb } from "./progress-repo";
import { submissions } from "./schema";

/**
 * Client-validated per-problem telemetry, computed from submission history:
 *  - successRate = distinct solvers / distinct attempters (0–1)
 *  - avgSolveMs  = average duration of passing submissions
 *  - sampleSize  = distinct attempters
 *
 * Browser validation is not a server-verifiable completion claim. The dashboard
 * labels this source and keeps the authored estimate below a sample floor.
 * One GROUP BY over an indexed table; the page caches it with ISR.
 */

export interface LevelStat {
  attempters: number;
  solvers: number;
  successRate: number;
  avgSolveMs: number | null;
  sampleSize: number;
}

export async function readLevelStats(db: ProgressDb): Promise<Record<string, LevelStat>> {
  const rows = await db
    .select({
      slug: submissions.levelSlug,
      attempters: countDistinct(submissions.userId),
      solvers: countDistinct(sql`case when ${submissions.passed} then ${submissions.userId} end`),
      avgSolveMs: sql<
        string | null
      >`avg(${submissions.durationMs}) filter (where ${submissions.passed})`,
    })
    .from(submissions)
    .groupBy(submissions.levelSlug);

  const out: Record<string, LevelStat> = {};
  for (const row of rows) {
    const attempters = Number(row.attempters) || 0;
    const solvers = Number(row.solvers) || 0;
    const avg = row.avgSolveMs === null ? null : Number(row.avgSolveMs);
    out[row.slug] = {
      attempters,
      solvers,
      successRate: attempters > 0 ? solvers / attempters : 0,
      avgSolveMs: avg !== null && Number.isFinite(avg) ? Math.round(avg) : null,
      sampleSize: attempters,
    };
  }
  return out;
}
