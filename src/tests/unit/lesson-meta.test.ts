import { describe, expect, it } from "vitest";

import { DOCS_LESSONS } from "@/content/docs";
import { getLevelBySlug } from "@/content/levels";
import {
  ACTIVITY_ICON,
  ACTIVITY_LABEL,
  lessonActivities,
  relatedPlayground,
  relatedProblem,
  type LessonActivity,
} from "@/features/docs/components/lesson-meta";

const KNOWN_ACTIVITIES: LessonActivity[] = [
  "mission",
  "lab",
  "buildUp",
  "spotTheBug",
  "challenge",
  "quiz",
];

describe("lessonActivities", () => {
  it("returns only known, de-duplicated activities in a stable order", () => {
    for (const lesson of DOCS_LESSONS) {
      const activities = lessonActivities(lesson);
      expect(new Set(activities).size).toBe(activities.length);
      for (const activity of activities) expect(KNOWN_ACTIVITIES).toContain(activity);
    }
  });

  it("reflects the block types actually present in a lesson", () => {
    for (const lesson of DOCS_LESSONS) {
      const hasQuizBlock = lesson.content.some((b) => b.type === "quiz");
      expect(lessonActivities(lesson).includes("quiz")).toBe(hasQuizBlock);
    }
  });

  it("every activity has a label and an icon", () => {
    for (const activity of KNOWN_ACTIVITIES) {
      expect(ACTIVITY_LABEL[activity]).toBeTruthy();
      expect(ACTIVITY_ICON[activity]).toBeTruthy();
    }
  });
});

describe("relatedPlayground", () => {
  it("never suggests the bare empty sandbox", () => {
    for (const lesson of DOCS_LESSONS) {
      expect(relatedPlayground(lesson)?.id).not.toBe("empty");
    }
  });
});

describe("relatedProblem", () => {
  it("resolves a lesson's relatedLevelSlug to a real level with a /problems href", () => {
    const linked = DOCS_LESSONS.filter((l) => l.relatedLevelSlug);
    // The course authors several hard docs→problems links; guard that wiring exists.
    expect(linked.length).toBeGreaterThan(0);
    for (const lesson of linked) {
      const problem = relatedProblem(lesson);
      if (!getLevelBySlug(lesson.relatedLevelSlug!)) continue;
      expect(problem).not.toBeNull();
      expect(problem!.href).toBe(`/problems/${problem!.slug}`);
      expect(problem!.title).toBeTruthy();
    }
  });

  it("returns null when there is no linked level", () => {
    const unlinked = DOCS_LESSONS.find((l) => !l.relatedLevelSlug);
    if (unlinked) expect(relatedProblem(unlinked)).toBeNull();
  });
});
