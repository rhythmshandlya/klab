import { describe, expect, it } from "vitest";

import { getLevelBySlug, LEVEL_CATALOG, LEVELS } from "@/content/levels";
import { parseLevel } from "@/lib/domain/schemas";

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

  it("every 'available' catalog entry has a matching authored level", () => {
    for (const entry of LEVEL_CATALOG) {
      if (entry.status === "available") {
        expect(getLevelBySlug(entry.slug)).toBeDefined();
      }
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
