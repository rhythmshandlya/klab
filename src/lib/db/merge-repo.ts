import { sql } from "drizzle-orm";

import { getLevelBySlug } from "@/content/levels";
import type { Progress } from "@/lib/storage/local-progress";

import type { ProgressDb } from "./progress-repo";
import { bookmarks, hintReveals, progressAttempted, progressSolved } from "./schema";

/**
 * Merge a guest's localStorage Progress into a signed-in account. Idempotent by
 * construction (keyed upserts with GREATEST / DO NOTHING), so a repeated merge can't
 * double-count — the client also guards with a per-user marker.
 *
 * The guest blob stores only a TOTAL xp, not per-solve awards, so we reconstruct each
 * solve's awarded xp from the code catalog (gross level xp − imported hint penalty).
 * Because problems live in code, that lookup is available here on the server.
 */
export async function mergeGuestProgress(
  db: ProgressDb,
  userId: string,
  guest: Progress,
): Promise<void> {
  // Import hint penalties first as a synthetic reveal so per-slug totals survive; MAX
  // (not sum) so a re-import can't inflate them.
  for (const [slug, penalty] of Object.entries(guest.hintPenalties)) {
    if (penalty > 0) {
      await db
        .insert(hintReveals)
        .values({ userId, levelSlug: slug, hintId: "__imported__", penalty })
        .onConflictDoUpdate({
          target: [hintReveals.userId, hintReveals.levelSlug, hintReveals.hintId],
          set: { penalty: sql`greatest(${hintReveals.penalty}, ${penalty})` },
        });
    }
  }

  const day = guest.lastSolvedDay ?? "1970-01-01";
  for (const slug of guest.solvedLevelSlugs) {
    const gross = getLevelBySlug(slug)?.xp ?? 0;
    const penalty = guest.hintPenalties[slug] ?? 0;
    const awardedXp = Math.max(0, gross - penalty);
    await db
      .insert(progressSolved)
      .values({ userId, levelSlug: slug, awardedXp, solvedDay: day })
      .onConflictDoUpdate({
        target: [progressSolved.userId, progressSolved.levelSlug],
        set: { awardedXp: sql`greatest(${progressSolved.awardedXp}, ${awardedXp})` },
      });
  }

  for (const slug of guest.attemptedLevelSlugs) {
    await db.insert(progressAttempted).values({ userId, levelSlug: slug }).onConflictDoNothing();
  }
  for (const slug of guest.savedProblemSlugs) {
    await db.insert(bookmarks).values({ userId, levelSlug: slug }).onConflictDoNothing();
  }
}
