"use client";

import Link from "next/link";

import { icons } from "@/components/icons";
import type { CurriculumLessonSummary, CurriculumSection } from "@/content/curriculum/model";
import { cn } from "@/lib/utils/cn";

import { ACTIVITY_ICON, ACTIVITY_LABEL } from "./lesson-meta";

type StageStatus = "done" | "current" | "upcoming";

/** One-line "what you can do after this" outcome per section (display copy). */
const SECTION_OUTCOME: Record<string, string> = {
  Foundations: "Read any manifest and explain what the cluster does with it.",
  Workloads: "Pick and run the right workload type for any application.",
  Networking: "Route traffic to your pods — and debug it when it doesn't arrive.",
  "Observability & Debugging":
    "Trace a failure from symptom to cause using logs, events, and probes.",
  Operations: "Ship changes safely and keep workloads healthy under load.",
  "Real Incidents": "Debug real-world outages end to end, the way you would on call.",
};

const REAL_INCIDENTS = "Real Incidents";

/**
 * The docs landing roadmap: every section is one stage on a single connected
 * vertical path, so the course reads as a route that leads somewhere rather than a
 * catalog. Each lesson is a rich card (activity chips + cross-links into Playground
 * and Problems). The final "Real Incidents" section is pulled out as a distinct
 * "Apply it" band — the payoff, not row six.
 */
export function LearningRoadmap({
  sections,
  completed,
}: {
  sections: readonly CurriculumSection[];
  completed: Set<string>;
}) {
  const stages = sections.filter((section) => section.title !== REAL_INCIDENTS);
  const incidents = sections.find((section) => section.title === REAL_INCIDENTS);

  // The "current" stage is the first that still has an incomplete lesson.
  const currentIndex = stages.findIndex(
    (section) => !section.lessons.every((lesson) => completed.has(lesson.key)),
  );

  return (
    <div className="space-y-4">
      <ol className="relative">
        {stages.map((section, index) => {
          const status: StageStatus =
            currentIndex === -1 || index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming";
          const isLast = index === stages.length - 1;
          return (
            <li key={section.title} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute top-9 left-[15px] w-px",
                    status === "done" ? "bg-green/40" : "bg-border",
                  )}
                  style={{ height: "calc(100% - 1rem)" }}
                  aria-hidden
                />
              ) : null}
              <StageDot status={status} number={index + 1} />
              <Stage section={section} status={status} completed={completed} />
            </li>
          );
        })}
      </ol>

      {incidents ? <RealIncidentsBand section={incidents} completed={completed} /> : null}
    </div>
  );
}

function StageDot({ status, number }: { status: StageStatus; number: number }) {
  if (status === "done") {
    return (
      <icons.success
        className="text-green z-10 size-8 shrink-0"
        aria-label={`Stage ${number} complete`}
      />
    );
  }
  if (status === "current") {
    return (
      <span
        className="bg-blue/15 border-blue text-blue relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
        aria-label={`Stage ${number}, current`}
      >
        <span
          className="bg-blue/25 absolute inline-flex size-full animate-ping rounded-full"
          aria-hidden
        />
        <span className="relative">{number}</span>
      </span>
    );
  }
  return (
    <span
      className="border-border text-subtle bg-panel z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
      aria-label={`Stage ${number}, not started`}
    >
      {number}
    </span>
  );
}

function Stage({
  section,
  status,
  completed,
}: {
  section: CurriculumSection;
  status: StageStatus;
  completed: Set<string>;
}) {
  const done = section.lessons.filter((lesson) => completed.has(lesson.key)).length;
  return (
    <section className="min-w-0 flex-1 pt-0.5">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className={cn(
              "text-base font-semibold tracking-tight",
              status === "upcoming" ? "text-muted" : "text-foreground",
            )}
          >
            {section.title}
          </h2>
          <span className="text-subtle shrink-0 text-xs tabular-nums">
            {done}/{section.lessons.length}
          </span>
        </div>
        {SECTION_OUTCOME[section.title] ? (
          <p className="text-muted mt-1 text-[13px] leading-relaxed">
            {SECTION_OUTCOME[section.title]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {section.lessons.map((lesson) => (
          <LessonCard key={lesson.key} lesson={lesson} done={completed.has(lesson.key)} />
        ))}
      </div>
    </section>
  );
}

function LessonCard({ lesson, done }: { lesson: CurriculumLessonSummary; done: boolean }) {
  const { activities, relatedPlayground: playground, relatedProblem: problem } = lesson;

  return (
    <div
      className={cn(
        "border-border bg-panel hover:border-border-strong group flex flex-col rounded-lg border p-3 transition-colors",
        done && "border-green/25",
      )}
    >
      <Link href={lesson.href} className="min-w-0">
        <div className="flex items-start gap-2">
          {done ? (
            <icons.success className="text-green mt-0.5 size-4 shrink-0" aria-label="Completed" />
          ) : (
            <span
              className="border-border mt-0.5 size-4 shrink-0 rounded-full border"
              aria-hidden
            />
          )}
          <span className="text-foreground group-hover:text-blue min-w-0 flex-1 text-sm font-medium transition-colors">
            {lesson.title}
          </span>
        </div>
        <p className="text-muted mt-1 line-clamp-2 pl-6 text-xs leading-relaxed">
          {lesson.description}
        </p>
      </Link>

      {activities.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1 pl-6">
          {activities.map((activity) => {
            const Icon = icons[ACTIVITY_ICON[activity]];
            return (
              <span
                key={activity}
                className="border-border bg-panel-elevated text-subtle inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium"
              >
                <Icon className="size-3" aria-hidden />
                {ACTIVITY_LABEL[activity]}
              </span>
            );
          })}
        </div>
      ) : null}

      {playground || problem ? (
        <div className="border-border/60 mt-2.5 flex flex-wrap items-center gap-3 border-t pt-2 pl-6">
          {playground ? (
            <PracticeLink href={playground.href} icon="playground" label="Try in sandbox" />
          ) : null}
          {problem ? (
            <PracticeLink href={problem.href} icon="problems" label="Debug the incident" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Cross-link chip from a lesson into the Playground or Problems mode. */
function PracticeLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: "playground" | "problems";
  label: string;
}) {
  const Icon = icons[icon];
  return (
    <Link
      href={href}
      className="text-subtle hover:text-blue group/link inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
    >
      <Icon className="size-3" aria-hidden />
      {label}
      <icons.arrowRight
        className="size-3 opacity-0 transition-opacity group-hover/link:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

/**
 * "Apply it" band — spotlights Real Incidents as the capstone rather than a sixth
 * flat row. Amber accent + framing set it apart from the learning stages above.
 */
function RealIncidentsBand({
  section,
  completed,
}: {
  section: CurriculumSection;
  completed: Set<string>;
}) {
  const done = section.lessons.filter((lesson) => completed.has(lesson.key)).length;
  return (
    <section className="border-amber/30 from-amber/5 rounded-lg border bg-gradient-to-br to-transparent p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-amber flex items-center gap-2">
            <icons.warning className="size-4" aria-hidden />
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">Apply it</span>
          </div>
          <h2 className="text-foreground mt-1.5 text-base font-semibold tracking-tight">
            {section.title}
          </h2>
          <p className="text-muted mt-1 text-[13px] leading-relaxed">
            {SECTION_OUTCOME[section.title]}
          </p>
        </div>
        <span className="text-subtle shrink-0 text-xs tabular-nums">
          {done}/{section.lessons.length}
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {section.lessons.map((lesson) => (
          <LessonCard key={lesson.key} lesson={lesson} done={completed.has(lesson.key)} />
        ))}
      </div>
    </section>
  );
}
