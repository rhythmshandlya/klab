import type { Mission } from "@/lib/domain/mission-types";
import type { Difficulty, DocsLesson, KubernetesConcept } from "@/lib/domain/types";

export type LessonActivity = "mission" | "lab" | "buildUp" | "spotTheBug" | "challenge" | "quiz";

export interface CurriculumLink {
  key: string;
  href: string;
  title: string;
}

export interface CurriculumPracticeLink {
  href: string;
  title: string;
}

export interface CurriculumProblemLink extends CurriculumPracticeLink {
  difficulty: Difficulty;
}

/** Small, serializable lesson metadata safe to pass through a client seam. */
export interface CurriculumLessonSummary extends CurriculumLink {
  description: string;
  section: string;
  order: number;
  concepts: readonly KubernetesConcept[];
  activities: readonly LessonActivity[];
  relatedPlayground?: CurriculumPracticeLink;
  relatedProblem?: CurriculumProblemLink;
}

export interface CurriculumSection {
  title: string;
  lessons: readonly CurriculumLessonSummary[];
}

export interface CurriculumMissionSummary extends CurriculumLink {
  section: string;
  order: number;
  goal: string;
}

export interface CurriculumMissionSection {
  title: string;
  missions: readonly CurriculumMissionSummary[];
}

/** The complete lightweight navigation/search catalog. It contains no authored bodies. */
export interface CurriculumCatalog {
  defaultLessonKey: string;
  sections: readonly CurriculumSection[];
  missionSections: readonly CurriculumMissionSection[];
}

export interface LessonRail {
  headings: readonly { id: string; text: string }[];
  lab?: { id: string; title: string; prompt: string };
  related: readonly CurriculumLink[];
  takeaway?: string;
  relatedProblem?: CurriculumProblemLink;
  sources: readonly { title: string; href: string }[];
}

/** Server page projection: full body stays server-side; client islands receive narrow fields. */
export interface CurriculumLessonPage {
  catalog: CurriculumCatalog;
  lesson: DocsLesson;
  current: CurriculumLessonSummary;
  previous?: CurriculumLink;
  next?: CurriculumLink;
  rail: LessonRail;
  playgroundFiles?: Record<string, string>;
}

export interface MissionRun {
  mission: Mission;
  initialManifests: readonly string[];
}

export function curriculumLessons(catalog: CurriculumCatalog): readonly CurriculumLessonSummary[] {
  return catalog.sections.flatMap((section) => section.lessons);
}
