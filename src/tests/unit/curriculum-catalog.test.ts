import { describe, expect, it } from "vitest";

import { curriculumLessons } from "@/content/curriculum/model";
import {
  compileCurriculum,
  getCurriculumCatalog,
  getCurriculumLesson,
  getMissionRun,
} from "@/content/curriculum/server";
import { DOCS_LESSON_IMPLEMENTATIONS } from "@/content/docs/all-lessons";
import { LEVEL_CATALOG } from "@/content/levels";
import { MISSIONS, accumulatedSeedManifests } from "@/content/missions";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";

const CATALOG = getCurriculumCatalog();
const LESSONS = curriculumLessons(CATALOG);
const INPUTS = {
  lessons: DOCS_LESSON_IMPLEMENTATIONS,
  missions: MISSIONS,
  problems: LEVEL_CATALOG,
  playgrounds: PLAYGROUND_TEMPLATES,
};

describe("Curriculum catalog", () => {
  it("is a compact, body-free projection of every authored lesson", () => {
    expect(LESSONS).toHaveLength(DOCS_LESSON_IMPLEMENTATIONS.length);

    for (const implementation of DOCS_LESSON_IMPLEMENTATIONS) {
      const key = implementation.slug.join("/");
      const summary = LESSONS.find((candidate) => candidate.key === key);
      expect(summary).toMatchObject({
        key,
        href: `/docs/${key}`,
        title: implementation.title,
        description: implementation.description,
        section: implementation.section,
        order: implementation.order,
        concepts: implementation.concepts,
      });
    }

    const forbiddenKeys = new Set([
      "content",
      "labs",
      "steps",
      "seedManifests",
      "files",
      "initialValue",
      "initialManifests",
      "solution",
      "correct",
    ]);
    const found: string[] = [];
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`));
        return;
      }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (forbiddenKeys.has(key)) found.push(`${path}.${key}`);
        visit(child, `${path}.${key}`);
      }
    };
    visit(CATALOG, "catalog");

    expect(found).toEqual([]);
    expect(new TextEncoder().encode(JSON.stringify(CATALOG)).byteLength).toBeLessThan(35_000);
  });

  it("orders sections and neighbors independently of registration order", () => {
    expect(CATALOG.sections.map((section) => section.title)).toEqual([
      "Foundations",
      "Workloads",
      "Networking",
      "Observability & Debugging",
      "Operations",
      "Real Incidents",
    ]);
    expect(new Set(LESSONS.map((lesson) => lesson.key)).size).toBe(LESSONS.length);

    for (const section of CATALOG.sections) {
      expect(section.lessons.map((lesson) => lesson.order)).toEqual(
        [...section.lessons.map((lesson) => lesson.order)].sort((left, right) => left - right),
      );
    }

    for (const [index, summary] of LESSONS.entries()) {
      const page = getCurriculumLesson(summary.key.split("/"));
      expect(page?.previous?.key).toBe(LESSONS[index - 1]?.key);
      expect(page?.next?.key).toBe(LESSONS[index + 1]?.key);
    }

    expect(
      compileCurriculum({
        ...INPUTS,
        lessons: [...INPUTS.lessons].reverse(),
        missions: [...INPUTS.missions].reverse(),
      }),
    ).toEqual(CATALOG);
  });

  it("prepares narrow per-page rail and playground projections", () => {
    for (const implementation of DOCS_LESSON_IMPLEMENTATIONS) {
      const page = getCurriculumLesson(implementation.slug);
      expect(page).toBeDefined();
      expect(page!.rail.headings).toEqual(
        implementation.content.flatMap((block) =>
          block.type === "heading" ? [{ id: block.id, text: block.text }] : [],
        ),
      );
      expect(page!.rail.lab?.id).toBe(implementation.labs[0]?.id);
      expect(page!.playgroundFiles).toEqual(
        implementation.labs[0]
          ? Object.fromEntries(
              implementation.labs[0].files.map((file) => [file.path, file.initialValue]),
            )
          : undefined,
      );
    }
  });

  it("resolves one mission run with its accumulated cluster seed", () => {
    for (const mission of MISSIONS) {
      const run = getMissionRun(mission.slug.join("/"));
      expect(run?.mission).toBe(mission);
      expect(run?.initialManifests).toEqual(accumulatedSeedManifests(mission));
    }
    expect(getMissionRun("missing/mission")).toBeUndefined();
    expect(getCurriculumLesson(["missing", "lesson"])).toBeUndefined();
  });

  it("rejects ambiguous or unknown authoring registrations", () => {
    const first = DOCS_LESSON_IMPLEMENTATIONS[0]!;
    const second = DOCS_LESSON_IMPLEMENTATIONS[1]!;

    expect(() =>
      compileCurriculum({
        ...INPUTS,
        lessons: [first, { ...second, slug: [...first.slug] }],
      }),
    ).toThrow(/Duplicate lesson key/);

    expect(() =>
      compileCurriculum({
        ...INPUTS,
        lessons: [first, { ...second, order: first.order }],
      }),
    ).toThrow(/Duplicate lesson order/);

    expect(() =>
      compileCurriculum({
        ...INPUTS,
        lessons: [{ ...first, section: "Unknown" }],
      }),
    ).toThrow(/Unknown lesson section/);
  });
});
