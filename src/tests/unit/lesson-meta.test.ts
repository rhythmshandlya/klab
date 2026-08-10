import { describe, expect, it } from "vitest";

import { curriculumLessons, type LessonActivity } from "@/content/curriculum/model";
import { getCurriculumCatalog, getCurriculumLesson } from "@/content/curriculum/server";
import { ACTIVITY_ICON, ACTIVITY_LABEL } from "@/features/docs/components/lesson-meta";

const KNOWN_ACTIVITIES: LessonActivity[] = [
  "mission",
  "lab",
  "buildUp",
  "spotTheBug",
  "challenge",
  "quiz",
];

const LESSONS = curriculumLessons(getCurriculumCatalog());

describe("curriculum lesson metadata", () => {
  it("compiles known, de-duplicated activities in a stable display order", () => {
    for (const lesson of LESSONS) {
      expect(new Set(lesson.activities).size).toBe(lesson.activities.length);
      expect(lesson.activities).toEqual(
        KNOWN_ACTIVITIES.filter((activity) => lesson.activities.includes(activity)),
      );
    }
  });

  it("reflects the authored block types without exposing those bodies", () => {
    for (const summary of LESSONS) {
      const page = getCurriculumLesson(summary.key.split("/"));
      expect(page).toBeDefined();
      const hasQuizBlock = page!.lesson.content.some((block) => block.type === "quiz");
      expect(summary.activities.includes("quiz")).toBe(hasQuizBlock);
    }
  });

  it("gives every activity a label and icon", () => {
    for (const activity of KNOWN_ACTIVITIES) {
      expect(ACTIVITY_LABEL[activity]).toBeTruthy();
      expect(ACTIVITY_ICON[activity]).toBeTruthy();
    }
  });

  it("never suggests the bare empty sandbox", () => {
    for (const lesson of LESSONS) {
      expect(lesson.relatedPlayground?.href).not.toBe("/playground/empty");
    }
  });

  it("compiles explicit problem references into playable links", () => {
    const linked = LESSONS.filter((lesson) => lesson.relatedProblem);
    expect(linked.length).toBeGreaterThan(0);
    for (const lesson of linked) {
      expect(lesson.relatedProblem?.href).toMatch(/^\/problems\//);
      expect(lesson.relatedProblem?.title).toBeTruthy();
    }
  });
});
