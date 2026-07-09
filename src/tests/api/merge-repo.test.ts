import { describe, expect, it } from "vitest";

import { mergeGuestProgress } from "@/lib/db/merge-repo";
import { readProgress } from "@/lib/db/progress-repo";
import { EMPTY_PROGRESS, type Progress } from "@/lib/storage/local-progress";

import { createTestDb, seedUser } from "./pglite";

// Uses real code-catalog slugs so xp reconstruction is exercised end to end.
// broken-readiness-probe is a 100-xp beginner level.
const GUEST: Progress = {
  ...EMPTY_PROGRESS,
  xp: 85,
  streakDays: 1,
  lastSolvedDay: "2026-07-08",
  solvedLevelSlugs: ["broken-readiness-probe"],
  hintPenalties: { "broken-readiness-probe": 15 },
  attemptedLevelSlugs: ["service-selector-mismatch"],
  savedProblemSlugs: ["port-routing-bug"],
};

describe("mergeGuestProgress over pglite", () => {
  it("reconstructs per-slug xp and merges all facts", async () => {
    const { db, client } = await createTestDb();
    try {
      const uid = await seedUser(db);
      await mergeGuestProgress(db, uid, GUEST);
      const p = await readProgress(db, uid);

      expect(p.solvedLevelSlugs).toEqual(["broken-readiness-probe"]);
      expect(p.attemptedLevelSlugs).toEqual(["service-selector-mismatch"]);
      expect(p.savedProblemSlugs).toEqual(["port-routing-bug"]);
      expect(p.hintPenalties).toEqual({ "broken-readiness-probe": 15 });
      expect(p.xp).toBe(85); // gross 100 − 15 penalty, reconstructed from the catalog
    } finally {
      await client.close();
    }
  });

  it("is idempotent — merging twice equals once", async () => {
    const { db, client } = await createTestDb();
    try {
      const uid = await seedUser(db);
      await mergeGuestProgress(db, uid, GUEST);
      await mergeGuestProgress(db, uid, GUEST);
      const p = await readProgress(db, uid);

      expect(p.solvedLevelSlugs).toEqual(["broken-readiness-probe"]);
      expect(p.hintPenalties).toEqual({ "broken-readiness-probe": 15 }); // NOT 30
      expect(p.xp).toBe(85); // NOT doubled
    } finally {
      await client.close();
    }
  });
});
