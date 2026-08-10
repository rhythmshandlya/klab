import type { DocsLesson } from "@/lib/domain/types";

import { FOUNDATIONS_LESSONS } from "./lessons/foundations";
import { WORKLOAD_LESSONS } from "./lessons/workloads";
import { NETWORKING_LESSONS } from "./lessons/networking";
import { DEBUGGING_LESSONS } from "./lessons/debugging";
import { OPERATIONS_LESSONS } from "./lessons/operations";
import { INCIDENT_LESSONS } from "./lessons/incidents";

/** Full authored corpus for the server Curriculum implementation and invariant tests. */
export const DOCS_LESSON_IMPLEMENTATIONS: readonly DocsLesson[] = [
  ...FOUNDATIONS_LESSONS,
  ...WORKLOAD_LESSONS,
  ...NETWORKING_LESSONS,
  ...DEBUGGING_LESSONS,
  ...OPERATIONS_LESSONS,
  ...INCIDENT_LESSONS,
];
