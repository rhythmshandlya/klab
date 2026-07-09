import { describe, expect, it } from "vitest";

import { DEFAULT_LESSON_SLUG, DOCS_LESSONS, DOCS_NAV, getLessonBySlug } from "@/content/docs";
import { parseLesson } from "@/lib/domain/schemas";

describe("docs content", () => {
  it("all lessons parse against the schema", () => {
    for (const lesson of DOCS_LESSONS) {
      expect(() => parseLesson(lesson)).not.toThrow();
    }
  });

  it("ships at least three interactive lessons", () => {
    const withLabs = DOCS_LESSONS.filter((l) => l.labs.length > 0);
    expect(withLabs.length).toBeGreaterThanOrEqual(3);
  });

  it("every `lab` content block references a real lab in the lesson", () => {
    for (const lesson of DOCS_LESSONS) {
      const labIds = new Set(lesson.labs.map((l) => l.id));
      for (const block of lesson.content) {
        if (block.type === "lab") expect(labIds.has(block.labId)).toBe(true);
      }
    }
  });

  it("resolves the default lesson and the three required slugs", () => {
    expect(getLessonBySlug(DEFAULT_LESSON_SLUG)).toBeDefined();
    for (const slug of [
      ["foundations", "desired-vs-actual-state"],
      ["networking", "services"],
      ["debugging", "readiness-probes"],
    ]) {
      expect(getLessonBySlug(slug)).toBeDefined();
    }
  });

  it("groups lessons into ordered sections for the nav", () => {
    expect(DOCS_NAV.length).toBeGreaterThan(0);
    expect(DOCS_NAV.every((s) => s.lessons.length > 0)).toBe(true);
  });
});
