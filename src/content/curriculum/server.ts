import { DOCS_LESSON_IMPLEMENTATIONS } from "@/content/docs/all-lessons";
import { LEVEL_CATALOG } from "@/content/levels";
import { MISSIONS, accumulatedSeedManifests } from "@/content/missions";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import type { Mission } from "@/lib/domain/mission-types";
import type { Difficulty, DocsBlock, DocsLesson, PlaygroundTemplate } from "@/lib/domain/types";

import type {
  CurriculumCatalog,
  CurriculumLessonPage,
  CurriculumLessonSummary,
  CurriculumLink,
  CurriculumMissionSummary,
  LessonActivity,
  LessonRail,
  MissionRun,
} from "./model";

const SECTION_ORDER = [
  "Foundations",
  "Workloads",
  "Networking",
  "Observability & Debugging",
  "Operations",
  "Real Incidents",
] as const;

const DEFAULT_LESSON_KEY = "foundations/desired-vs-actual-state";

const ACTIVITY_ORDER: readonly LessonActivity[] = [
  "mission",
  "lab",
  "buildUp",
  "spotTheBug",
  "challenge",
  "quiz",
];

const BLOCK_TO_ACTIVITY: Partial<Record<DocsBlock["type"], LessonActivity>> = {
  mission: "mission",
  lab: "lab",
  buildUp: "buildUp",
  spotTheBug: "spotTheBug",
  challenge: "challenge",
  quiz: "quiz",
};

interface ProblemProjection {
  slug: string;
  title: string;
  difficulty: Difficulty;
}

interface CurriculumInputs {
  lessons: readonly DocsLesson[];
  missions: readonly Mission[];
  problems: readonly ProblemProjection[];
  playgrounds: readonly Pick<PlaygroundTemplate, "id" | "title" | "concepts">[];
}

function lessonKey(lesson: Pick<DocsLesson, "slug">): string {
  return lesson.slug.join("/");
}

function lessonLink(lesson: CurriculumLessonSummary): CurriculumLink {
  return { key: lesson.key, href: lesson.href, title: lesson.title };
}

function missionSummary(mission: Mission): CurriculumMissionSummary {
  const key = mission.slug.join("/");
  return {
    key,
    href: `/docs/${key}`,
    title: mission.title,
    section: mission.section,
    order: mission.order,
    goal: mission.coldOpen.goal,
  };
}

function lessonActivities(lesson: DocsLesson): readonly LessonActivity[] {
  const present = new Set<LessonActivity>();
  for (const block of lesson.content) {
    const activity = BLOCK_TO_ACTIVITY[block.type];
    if (activity) present.add(activity);
  }
  return ACTIVITY_ORDER.filter((activity) => present.has(activity));
}

function relatedPlayground(
  lesson: DocsLesson,
  playgrounds: CurriculumInputs["playgrounds"],
): CurriculumLessonSummary["relatedPlayground"] {
  const concepts = new Set(lesson.concepts);
  let best: { id: string; title: string; overlap: number } | undefined;

  for (const playground of playgrounds) {
    if (playground.id === "empty") continue;
    const overlap = playground.concepts.filter((concept) => concepts.has(concept)).length;
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { id: playground.id, title: playground.title, overlap };
    }
  }

  return best ? { href: `/playground/${best.id}`, title: best.title } : undefined;
}

function summarizeLesson(
  lesson: DocsLesson,
  inputs: Pick<CurriculumInputs, "problems" | "playgrounds">,
): CurriculumLessonSummary {
  const key = lessonKey(lesson);
  const problem = lesson.relatedLevelSlug
    ? inputs.problems.find((candidate) => candidate.slug === lesson.relatedLevelSlug)
    : undefined;

  return {
    key,
    href: `/docs/${key}`,
    title: lesson.title,
    description: lesson.description,
    section: lesson.section,
    order: lesson.order,
    concepts: lesson.concepts,
    activities: lessonActivities(lesson),
    relatedPlayground: relatedPlayground(lesson, inputs.playgrounds),
    relatedProblem: problem
      ? {
          href: `/problems/${problem.slug}`,
          title: problem.title,
          difficulty: problem.difficulty,
        }
      : undefined,
  };
}

function assertUniqueRegistration(
  kind: "lesson" | "mission",
  values: readonly { key: string; section: string; order: number }[],
): void {
  const keys = new Set<string>();
  const positions = new Set<string>();

  for (const value of values) {
    if (keys.has(value.key)) throw new Error(`Duplicate ${kind} key: ${value.key}`);
    keys.add(value.key);

    const position = `${value.section}:${value.order}`;
    if (positions.has(position)) throw new Error(`Duplicate ${kind} order: ${position}`);
    positions.add(position);
  }
}

/**
 * Compile authored implementations into the stable, body-free Curriculum interface.
 * Validation, ordering, cross-mode links, and activity inference stay behind this seam.
 */
export function compileCurriculum(inputs: CurriculumInputs): CurriculumCatalog {
  const sectionRank = new Map<string, number>(SECTION_ORDER.map((title, index) => [title, index]));
  const summaries = inputs.lessons.map((lesson) => summarizeLesson(lesson, inputs));

  for (const lesson of summaries) {
    if (!sectionRank.has(lesson.section)) {
      throw new Error(`Unknown lesson section: ${lesson.section}`);
    }
  }
  assertUniqueRegistration("lesson", summaries);

  const missions = inputs.missions.map(missionSummary);
  for (const mission of missions) {
    if (!sectionRank.has(mission.section)) {
      throw new Error(`Unknown mission section: ${mission.section}`);
    }
  }
  assertUniqueRegistration("mission", missions);

  const sections = SECTION_ORDER.map((title) => ({
    title,
    lessons: summaries
      .filter((lesson) => lesson.section === title)
      .sort((left, right) => left.order - right.order),
  })).filter((section) => section.lessons.length > 0);

  const missionSections = SECTION_ORDER.map((title) => ({
    title,
    missions: missions
      .filter((mission) => mission.section === title)
      .sort((left, right) => left.order - right.order),
  })).filter((section) => section.missions.length > 0);

  if (!summaries.some((lesson) => lesson.key === DEFAULT_LESSON_KEY)) {
    throw new Error(`Default lesson is not registered: ${DEFAULT_LESSON_KEY}`);
  }

  return { defaultLessonKey: DEFAULT_LESSON_KEY, sections, missionSections };
}

const INPUTS: CurriculumInputs = {
  lessons: DOCS_LESSON_IMPLEMENTATIONS,
  missions: MISSIONS,
  problems: LEVEL_CATALOG,
  playgrounds: PLAYGROUND_TEMPLATES,
};

const CATALOG = compileCurriculum(INPUTS);
const ORDERED_LESSONS = CATALOG.sections.flatMap((section) => section.lessons);
const LESSONS_BY_KEY = new Map(
  DOCS_LESSON_IMPLEMENTATIONS.map((lesson) => [lessonKey(lesson), lesson]),
);
const SUMMARIES_BY_KEY = new Map(ORDERED_LESSONS.map((lesson) => [lesson.key, lesson]));
const MISSIONS_BY_KEY = new Map(MISSIONS.map((mission) => [mission.slug.join("/"), mission]));

export function getCurriculumCatalog(): CurriculumCatalog {
  return CATALOG;
}

function lessonRail(lesson: DocsLesson, current: CurriculumLessonSummary): LessonRail {
  const concepts = new Set(lesson.concepts);
  const related = ORDERED_LESSONS.filter(
    (candidate) =>
      candidate.key !== current.key && candidate.concepts.some((concept) => concepts.has(concept)),
  )
    .slice(0, 4)
    .map(lessonLink);
  const firstLab = lesson.labs[0];
  const takeaway = lesson.content.find((block) => block.type === "takeaways");

  return {
    headings: lesson.content.flatMap((block) =>
      block.type === "heading" ? [{ id: block.id, text: block.text }] : [],
    ),
    lab: firstLab ? { id: firstLab.id, title: firstLab.title, prompt: firstLab.prompt } : undefined,
    related,
    takeaway: takeaway?.items[0],
    relatedProblem: current.relatedProblem,
    sources: lesson.sources ?? [],
  };
}

export function getCurriculumLesson(slug: readonly string[]): CurriculumLessonPage | undefined {
  const key = slug.join("/");
  const lesson = LESSONS_BY_KEY.get(key);
  const current = SUMMARIES_BY_KEY.get(key);
  if (!lesson || !current) return undefined;

  const index = ORDERED_LESSONS.findIndex((candidate) => candidate.key === key);
  const previous = index > 0 ? ORDERED_LESSONS[index - 1] : undefined;
  const next = index >= 0 ? ORDERED_LESSONS[index + 1] : undefined;
  const firstLab = lesson.labs[0];

  return {
    catalog: CATALOG,
    lesson,
    current,
    previous: previous ? lessonLink(previous) : undefined,
    next: next ? lessonLink(next) : undefined,
    rail: lessonRail(lesson, current),
    playgroundFiles: firstLab
      ? Object.fromEntries(firstLab.files.map((file) => [file.path, file.initialValue]))
      : undefined,
  };
}

export function getMissionRun(slug: string): MissionRun | undefined {
  const mission = MISSIONS_BY_KEY.get(slug);
  if (!mission) return undefined;
  return { mission, initialManifests: accumulatedSeedManifests(mission) };
}
