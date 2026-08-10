import type { IconName } from "@/components/icons";
import type { LessonActivity } from "@/content/curriculum/model";

export type { LessonActivity } from "@/content/curriculum/model";

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
