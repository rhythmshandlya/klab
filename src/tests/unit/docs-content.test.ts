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

  it("has unique heading ids within each lesson", () => {
    for (const lesson of DOCS_LESSONS) {
      const ids = lesson.content.flatMap((b) => (b.type === "heading" ? [b.id] : []));
      expect(new Set(ids).size, `duplicate heading id in ${lesson.slug.join("/")}`).toBe(ids.length);
    }
  });

  it("gives every quiz exactly one correct option", () => {
    for (const lesson of DOCS_LESSONS) {
      for (const block of lesson.content) {
        if (block.type === "quiz") {
          const correct = block.options.filter((o) => o.correct).length;
          expect(correct, `${lesson.slug.join("/")} quiz ${block.id}`).toBe(1);
        }
      }
    }
  });

  it("keeps decisionTable rows aligned with their columns", () => {
    for (const lesson of DOCS_LESSONS) {
      for (const block of lesson.content) {
        if (block.type === "decisionTable") {
          for (const row of block.rows) {
            expect(
              row.cells.length,
              `${lesson.slug.join("/")} decisionTable row "${row.label}"`,
            ).toBe(block.columns.length);
          }
        }
      }
    }
  });
});
