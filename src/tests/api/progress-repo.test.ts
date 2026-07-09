import { describe, expect, it } from "vitest";

import { applyIntents, deriveStreak, readProgress } from "@/lib/db/progress-repo";
import type { ProgressIntent } from "@/lib/storage/progress-intent";

import { createTestDb, seedUser } from "./pglite";

describe("deriveStreak", () => {
  it("is zero with no solves", () => {
    expect(deriveStreak([])).toEqual({ streakDays: 0 });
  });

  it("counts a single day as a 1-day streak", () => {
    expect(deriveStreak(["2026-07-09"])).toEqual({ streakDays: 1, lastSolvedDay: "2026-07-09" });
  });

  it("counts consecutive days and ignores duplicates", () => {
    expect(deriveStreak(["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-09"])).toEqual({
      streakDays: 3,
      lastSolvedDay: "2026-07-09",
    });
  });

  it("resets the run at a gap, counting only the streak ending on the last day", () => {
    expect(deriveStreak(["2026-07-01", "2026-07-08", "2026-07-09"])).toEqual({
      streakDays: 2,
      lastSolvedDay: "2026-07-09",
    });
  });

  it("crosses a month boundary", () => {
    expect(deriveStreak(["2026-06-30", "2026-07-01"])).toEqual({
      streakDays: 2,
      lastSolvedDay: "2026-07-01",
    });
  });
});

describe("progress-repo over pglite", () => {
  const INTENTS: ProgressIntent[] = [
    { kind: "attempted", slug: "a" },
    { kind: "revealHint", slug: "a", hintId: "h1", penalty: 15 },
    { kind: "solved", slug: "a", xp: 100, day: "2026-07-08" },
    { kind: "setSaved", slug: "b", saved: true },
    { kind: "submission", slug: "a", passed: true, checksTotal: 3, checksPassed: 3, durationMs: 42000 },
  ];

  it("applies intents and projects the derived Progress snapshot", async () => {
    const { db, client } = await createTestDb();
    try {
      const uid = await seedUser(db);
      await applyIntents(db, uid, INTENTS);
      const p = await readProgress(db, uid);

      expect(p.solvedLevelSlugs).toEqual(["a"]);
      expect(p.attemptedLevelSlugs).toEqual(["a"]);
      expect(p.savedProblemSlugs).toEqual(["b"]);
      expect(p.hintPenalties).toEqual({ a: 15 });
      expect(p.xp).toBe(85); // gross 100 − 15 penalty, netted server-side
      expect(p.streakDays).toBe(1);
      expect(p.lastSolvedDay).toBe("2026-07-08");
    } finally {
      await client.close();
    }
  });

  it("is idempotent — applying the same batch twice equals once", async () => {
    const { db, client } = await createTestDb();
    try {
      const uid = await seedUser(db);
      await applyIntents(db, uid, INTENTS);
      await applyIntents(db, uid, INTENTS);
      const p = await readProgress(db, uid);

      expect(p.solvedLevelSlugs).toEqual(["a"]);
      expect(p.hintPenalties).toEqual({ a: 15 }); // NOT 30
      expect(p.xp).toBe(85); // NOT doubled
      expect(p.savedProblemSlugs).toEqual(["b"]);
    } finally {
      await client.close();
    }
  });

  it("setSaved is absolute — a false intent removes the bookmark", async () => {
    const { db, client } = await createTestDb();
    try {
      const uid = await seedUser(db);
      await applyIntents(db, uid, [{ kind: "setSaved", slug: "b", saved: true }]);
      await applyIntents(db, uid, [{ kind: "setSaved", slug: "b", saved: false }]);
      const p = await readProgress(db, uid);
      expect(p.savedProblemSlugs).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it("keeps two users' progress isolated", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      await applyIntents(db, a, [{ kind: "solved", slug: "a", xp: 100, day: "2026-07-08" }]);
      await applyIntents(db, b, [{ kind: "solved", slug: "z", xp: 200, day: "2026-07-08" }]);

      expect((await readProgress(db, a)).solvedLevelSlugs).toEqual(["a"]);
      expect((await readProgress(db, a)).xp).toBe(100);
      expect((await readProgress(db, b)).solvedLevelSlugs).toEqual(["z"]);
      expect((await readProgress(db, b)).xp).toBe(200);
    } finally {
      await client.close();
    }
  });
});
