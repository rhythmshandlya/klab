"use client";

import Link from "next/link";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { lessonHref } from "@/content/docs";
import { useProgress } from "@/features/progress/use-progress";
import type { DocsLesson } from "@/lib/domain/types";
import { mutateProgress } from "@/lib/storage/progress-store";

/**
 * End-of-lesson completion control. Marking complete is a grow-only fact (mirrors the
 * problem-solve model) synced through the same progress store, so the sidebar checkmark
 * and course-progress bar update instantly and follow the user across devices when
 * signed in. Answering a checkpoint quiz correctly also completes the lesson (see
 * `docs-quiz`), so this button is the explicit path for lessons without a quiz.
 */
export function LessonComplete({ lesson, next }: { lesson: DocsLesson; next?: DocsLesson }) {
  const progress = useProgress();
  const slug = lesson.slug.join("/");
  const done = progress.completedLessonSlugs.includes(slug);

  if (done) {
    return (
      <div className="border-green/30 bg-green/5 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
        <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <icons.success className="text-green size-4" aria-hidden />
          Lesson complete
        </p>
        {next ? (
          <Link
            href={lessonHref(next)}
            className="border-blue/40 bg-blue/10 text-foreground hover:bg-blue/15 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
          >
            Next: {next.title}
            <icons.arrowRight className="text-blue size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-border bg-panel flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
      <div>
        <p className="text-foreground text-sm font-semibold">Finished this lesson?</p>
        <p className="text-muted mt-0.5 text-sm">
          Mark it complete to track your progress through the course.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => mutateProgress({ kind: "completedLesson", slug })}
      >
        <icons.success aria-hidden />
        Mark complete
      </Button>
    </div>
  );
}
