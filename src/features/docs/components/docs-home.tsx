"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { DOCS_LESSONS, DOCS_NAV, lessonHref } from "@/content/docs";
import { isMissionSection } from "@/content/missions";
import { useProgress } from "@/features/progress/use-progress";

import { DocsMobileNav } from "./docs-mobile-nav";
import { DocsSidebar } from "./docs-sidebar";
import { JourneyHome } from "../mission/journey-home";

const ORDERED = DOCS_NAV.flatMap((s) => s.lessons);
// Migrated sections get an ordered mission path (JourneyHome) instead of the legacy
// flat lesson checklist below.
const LEGACY_NAV = DOCS_NAV.filter((section) => !isMissionSection(section.title));

/**
 * Docs landing page. Replaces the old redirect-to-first-lesson with a real course
 * home: overall progress, a resume/continue affordance that points at the first
 * incomplete lesson, client-side search, and per-section cards with completion.
 */
export function DocsHome() {
  const progress = useProgress();
  const [query, setQuery] = useState("");

  const completed = useMemo(
    () => new Set(progress.completedLessonSlugs),
    [progress.completedLessonSlugs],
  );
  const completedCount = ORDERED.filter((l) => completed.has(l.slug.join("/"))).length;
  const total = ORDERED.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Continue at the first lesson (in nav order) the learner hasn't completed.
  const resume = ORDERED.find((l) => !completed.has(l.slug.join("/"))) ?? ORDERED[0];
  const allDone = completedCount === total && total > 0;

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return DOCS_LESSONS.filter((l) => {
      const haystack = [l.title, l.section, l.description, ...l.concepts].join(" ").toLowerCase();
      return haystack.includes(q);
    }).slice(0, 12);
  }, [q]);

  return (
    <div className="mx-auto flex w-full max-w-[1520px]">
      <aside className="border-border hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsSidebar />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        <div className="mb-4 lg:hidden">
          <DocsMobileNav sectionLabel="Overview" />
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
              {total} lessons across {DOCS_NAV.length} sections, each with annotated manifests,
              build-it-up walkthroughs, spot-the-bug drills, live labs, and checkpoint quizzes. Read
              a concept, then break and fix it in a real simulated cluster.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {resume ? (
                <Link
                  href={lessonHref(resume)}
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
              aria-label="Search documentation"
              className="border-border bg-panel text-foreground placeholder:text-subtle focus:border-blue/60 h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors outline-none"
            />
          </label>
        </div>

        {q ? (
          <SearchResults results={results} completed={completed} query={query} />
        ) : (
          <>
            <div className="mt-6">
              <JourneyHome />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {LEGACY_NAV.map((section) => {
                const done = section.lessons.filter((l) => completed.has(l.slug.join("/"))).length;
                return (
                  <section
                    key={section.title}
                    className="border-border bg-panel rounded-lg border p-5"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-foreground text-sm font-semibold tracking-tight">
                        {section.title}
                      </h2>
                      <span className="text-subtle text-xs">
                        {done}/{section.lessons.length}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {section.lessons.map((lesson) => {
                        const isDone = completed.has(lesson.slug.join("/"));
                        return (
                          <li key={lesson.slug.join("/")}>
                            <Link
                              href={lessonHref(lesson)}
                              className="hover:bg-panel-hover group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                            >
                              {isDone ? (
                                <icons.success
                                  className="text-green size-4 shrink-0"
                                  aria-label="Completed"
                                />
                              ) : (
                                <span
                                  className="border-border size-4 shrink-0 rounded-full border"
                                  aria-hidden
                                />
                              )}
                              <span className="text-muted group-hover:text-foreground min-w-0 flex-1 truncate">
                                {lesson.title}
                              </span>
                              <icons.arrowRight
                                className="text-subtle size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
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
  results: typeof DOCS_LESSONS;
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
        const isDone = completed.has(lesson.slug.join("/"));
        return (
          <Link
            key={lesson.slug.join("/")}
            href={lessonHref(lesson)}
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
