import { describe, expect, it } from "vitest";

import { getLevelBySlug, LEVEL_CATALOG, LEVELS } from "@/content/levels";
import { LEVEL_SOLUTIONS } from "@/content/levels/solutions";
import { parseLevel } from "@/lib/domain/schemas";

const XP_BY_DIFFICULTY = { beginner: 100, intermediate: 150, advanced: 200 } as const;

describe("level content", () => {
  it("every authored level parses against the schema", () => {
    for (const level of LEVELS) {
      expect(() => parseLevel(level)).not.toThrow();
    }
  });

  it("has no duplicate catalog slugs", () => {
    const slugs = LEVEL_CATALOG.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every catalog entry is a playable authored level", () => {
    expect(LEVEL_CATALOG.length).toBeGreaterThanOrEqual(12);
    for (const entry of LEVEL_CATALOG) {
      expect(getLevelBySlug(entry.slug), entry.slug).toBeDefined();
    }
  });

  it("covers every difficulty tier with consistent XP", () => {
    for (const difficulty of ["beginner", "intermediate", "advanced"] as const) {
      const tier = LEVELS.filter((l) => l.difficulty === difficulty);
      expect(tier.length, `${difficulty} levels`).toBeGreaterThanOrEqual(4);
      for (const level of tier) {
        expect(level.xp, `${level.slug} xp`).toBe(XP_BY_DIFFICULTY[difficulty]);
      }
    }
  });

  it("every level has a canonical solution whose files match the editable files", () => {
    for (const level of LEVELS) {
      const solution = LEVEL_SOLUTIONS[level.slug];
      expect(solution, `${level.slug} solution`).toBeDefined();
      const editablePaths = new Set(level.files.map((f) => f.path));
      for (const path of Object.keys(solution!.files)) {
        expect(editablePaths.has(path), `${level.slug}: ${path} is editable`).toBe(true);
      }
    }
  });

  it("every level ships investigation affordances (quick commands, probe targets, hints)", () => {
    for (const level of LEVELS) {
      expect(level.quickCommands.length, `${level.slug} quickCommands`).toBeGreaterThan(0);
      expect(level.probeTargets.length, `${level.slug} probeTargets`).toBeGreaterThan(0);
      expect(level.hints.length, `${level.slug} hints`).toBeGreaterThanOrEqual(3);
      expect(level.evidenceRules.length, `${level.slug} evidenceRules`).toBeGreaterThanOrEqual(4);
      const totalPenalty = level.hints.reduce((sum, h) => sum + h.xpPenalty, 0);
      expect(totalPenalty, `${level.slug} hint penalties exceed level XP`).toBeLessThanOrEqual(
        level.xp,
      );
    }
  });

  it("hint unlock references point at real evidence rules", () => {
    for (const level of LEVELS) {
      const ruleIds = new Set(level.evidenceRules.map((r) => r.id));
      for (const hint of level.hints) {
        for (const ruleId of hint.unlockAfter ?? []) {
          expect(ruleIds.has(ruleId)).toBe(true);
        }
      }
    }
  });

  it("the reference level is playable and models the readiness bug", () => {
    const level = getLevelBySlug("broken-readiness-probe");
    expect(level).toBeDefined();
    expect(level?.files[0]?.initialValue).toContain("/readyz");
    expect(level?.validators.some((v) => v.kind === "service-has-ready-endpoints")).toBe(true);
  });
});
