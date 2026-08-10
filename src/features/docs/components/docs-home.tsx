"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  curriculumLessons,
  type CurriculumCatalog,
  type CurriculumLessonSummary,
} from "@/content/curriculum/model";
import { useProgress } from "@/features/progress/use-progress";

import { DocsMobileNav } from "./docs-mobile-nav";
import { DocsSidebar } from "./docs-sidebar";
import { LearningRoadmap } from "./learning-roadmap";

// Sold in the hero: the concrete skills the course leaves you with (the destination,
// not the inventory of lessons).
const OUTCOMES = ["Read any manifest", "Debug a crashing pod", "Ship a safe rollout"];

/**
 * Docs landing page. Replaces the old redirect-to-first-lesson with a real course
 * home: overall progress, a resume/continue affordance that points at the first
 * incomplete lesson, client-side search, and per-section cards with completion.
 */
export function DocsHome({ catalog }: { catalog: CurriculumCatalog }) {
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const ordered = useMemo(() => curriculumLessons(catalog), [catalog]);

  const completed = useMemo(
    () => new Set(progress.completedLessonSlugs),
    [progress.completedLessonSlugs],
  );
  const completedCount = ordered.filter((lesson) => completed.has(lesson.key)).length;
  const total = ordered.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Continue at the first lesson (in nav order) the learner hasn't completed.
  const resume = ordered.find((lesson) => !completed.has(lesson.key)) ?? ordered[0];
  const allDone = completedCount === total && total > 0;

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return ordered
      .filter((l) => {
        const haystack = [l.title, l.section, l.description, ...l.concepts].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [ordered, q]);

  return (
    <div className="mx-auto flex w-full max-w-[1520px]">
      <aside className="border-border hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsSidebar catalog={catalog} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        <div className="mb-4 lg:hidden">
          <DocsMobileNav catalog={catalog} sectionLabel="Overview" />
        </div>

        {/* Hero */}
        <div className="border-border bg-panel relative overflow-hidden rounded-lg border p-6 lg:p-8">
          <div className="bg-blue/10 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl" />
          <div className="relative">
            <Badge tone="achievement" className="mb-3">
              Interactive course
            </Badge>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight lg:text-4xl">
              Learn Kubernetes by breaking it
            </h1>
            <p className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
              Read a concept, then break and fix it in a real simulated cluster running in your
              browser. By the end you can debug a production incident with nothing but{" "}
              <code className="text-foreground font-mono text-[13px]">kubectl</code>.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {OUTCOMES.map((outcome) => (
                <span
                  key={outcome}
                  className="border-border bg-panel-elevated text-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                >
                  <icons.success className="text-green size-3.5" aria-hidden />
                  {outcome}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {resume ? (
                <Link
                  href={resume.href}
                  className="bg-blue text-background hover:bg-blue/90 inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors"
                >
                  <icons.docsInteractive className="size-4" aria-hidden />
                  {allDone
                    ? "Review the course"
                    : completedCount > 0
                      ? `Continue: ${resume.title}`
                      : `Start: ${resume.title}`}
                  <icons.arrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
              <Link
                href="/playground"
                className="border-border text-muted hover:border-border-strong hover:text-foreground inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors"
              >
                <icons.playground className="size-4" aria-hidden />
                Open the sandbox
              </Link>
              <span className="text-subtle text-sm">
                {completedCount} of {total} complete
              </span>
            </div>

            <div
              className="bg-panel-elevated mt-4 h-2 max-w-md overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
            >
              <div
                className="bg-blue h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
          <label className="relative block">
            <icons.search
              className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons and concepts…"
              aria-label="Search lessons"
              className="border-border bg-panel text-foreground placeholder:text-subtle focus:border-blue/60 h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors outline-none"
            />
          </label>
        </div>

        {q ? (
          <SearchResults results={results} completed={completed} query={query} />
        ) : (
          <div className="mt-8">
            <LearningRoadmap sections={catalog.sections} completed={completed} />
          </div>
        )}
      </main>
    </div>
  );
}

function SearchResults({
  results,
  completed,
  query,
}: {
  results: readonly CurriculumLessonSummary[];
  completed: Set<string>;
  query: string;
}) {
  if (results.length === 0) {
    return (
      <p className="text-subtle mt-6 text-sm">
        No lessons match “{query.trim()}”. Try a concept like “probe”, “selector”, or “rollout”.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      <p className="text-subtle text-xs">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      {results.map((lesson) => {
        const isDone = completed.has(lesson.key);
        return (
          <Link
            key={lesson.key}
            href={lesson.href}
            className="border-border bg-panel hover:border-border-strong hover:bg-panel-hover block rounded-md border p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isDone ? (
                <icons.success className="text-green size-4 shrink-0" aria-label="Completed" />
              ) : null}
              <span className="text-foreground text-sm font-medium">{lesson.title}</span>
              <Badge tone="neutral" className="ml-auto">
                {lesson.section}
              </Badge>
            </div>
            <p className="text-muted mt-1 line-clamp-2 text-xs leading-relaxed">
              {lesson.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
