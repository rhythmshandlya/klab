import type { IconName } from "@/components/icons";
import { getLevelBySlug } from "@/content/levels";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import type { Difficulty, DocsLesson, KubernetesConcept } from "@/lib/domain/types";

export type LessonActivity = "mission" | "lab" | "buildUp" | "spotTheBug" | "challenge" | "quiz";

/** Stable left-to-right display order for activity chips. */
const ACTIVITY_ORDER: LessonActivity[] = [
  "mission",
  "lab",
  "buildUp",
  "spotTheBug",
  "challenge",
  "quiz",
];

/** Maps an interactive DocsBlock type to the activity it represents. */
const BLOCK_TO_ACTIVITY: Partial<Record<string, LessonActivity>> = {
  mission: "mission",
  lab: "lab",
  buildUp: "buildUp",
  spotTheBug: "spotTheBug",
  challenge: "challenge",
  quiz: "quiz",
};

export const ACTIVITY_LABEL: Record<LessonActivity, string> = {
  mission: "Mission",
  lab: "Lab",
  buildUp: "Build-up",
  spotTheBug: "Spot the bug",
  challenge: "Challenge",
  quiz: "Quiz",
};

export const ACTIVITY_ICON: Record<LessonActivity, IconName> = {
  mission: "run",
  lab: "terminal",
  buildUp: "yaml",
  spotTheBug: "search",
  challenge: "challenge",
  quiz: "validate",
};

/** Distinct hands-on activities a lesson contains, in a stable display order. */
export function lessonActivities(lesson: DocsLesson): LessonActivity[] {
  const present = new Set<LessonActivity>();
  for (const block of lesson.content) {
    const activity = BLOCK_TO_ACTIVITY[block.type];
    if (activity) present.add(activity);
  }
  return ACTIVITY_ORDER.filter((a) => present.has(a));
}

export interface RelatedPlayground {
  id: string;
  title: string;
}

/**
 * Best-matching playground template for a lesson, by shared concept count. No
 * authored link exists between lessons and templates, so this is inferred from
 * the `KubernetesConcept` tags both share. The bare "empty" sandbox is skipped
 * since it matches every lesson trivially.
 */
export function relatedPlayground(lesson: DocsLesson): RelatedPlayground | null {
  const lessonConcepts = new Set<KubernetesConcept>(lesson.concepts);
  let best: { id: string; title: string; overlap: number } | null = null;
  for (const template of PLAYGROUND_TEMPLATES) {
    if (template.id === "empty") continue;
    const overlap = template.concepts.filter((c) => lessonConcepts.has(c)).length;
    if (overlap > 0 && (best === null || overlap > best.overlap)) {
      best = { id: template.id, title: template.title, overlap };
    }
  }
  return best === null ? null : { id: best.id, title: best.title };
}

export interface RelatedProblem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  href: string;
}

/**
 * The problems incident a lesson explicitly points at via `relatedLevelSlug` — an
 * authored, one-to-one link (unlike the inferred playground match). Returns null
 * when the lesson has no linked level or the slug no longer resolves.
 */
export function relatedProblem(lesson: DocsLesson): RelatedProblem | null {
  if (!lesson.relatedLevelSlug) return null;
  const level = getLevelBySlug(lesson.relatedLevelSlug);
  if (!level) return null;
  return {
    slug: level.slug,
    title: level.title,
    difficulty: level.difficulty,
    href: `/problems/${level.slug}`,
  };
}
