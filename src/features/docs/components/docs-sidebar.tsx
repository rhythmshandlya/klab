"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { icons, type IconName } from "@/components/icons";
import { DOCS_NAV, lessonHref } from "@/content/docs";
import { useProgress } from "@/features/progress/use-progress";
import { cn } from "@/lib/utils/cn";

const SECTION_ICON: Record<string, IconName> = {
  Foundations: "docs",
  Workloads: "deployment",
  Networking: "service",
  "Observability & Debugging": "terminal",
  Operations: "config",
  "Real Incidents": "warning",
};

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const progress = useProgress();
  const totalLessons = DOCS_NAV.reduce((sum, section) => sum + section.lessons.length, 0);

  const completed = useMemo(
    () => new Set(progress.completedLessonSlugs),
    [progress.completedLessonSlugs],
  );
  const completedCount = useMemo(
    () => DOCS_NAV.reduce((n, s) => n + s.lessons.filter((l) => completed.has(l.slug.join("/"))).length, 0),
    [completed],
  );
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <nav aria-label="Documentation" className="space-y-5 px-4">
      <div>
        <p className="text-subtle mb-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
          Documentation
        </p>
        <div className="border-border bg-panel rounded-md border p-3">
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <icons.docsInteractive className="text-green size-4" aria-hidden />
            Kubernetes Course
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {completedCount} of {totalLessons} lessons complete
          </p>
          <div
            className="bg-panel-elevated mt-3 h-1.5 overflow-hidden rounded-full"
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

      {DOCS_NAV.map((section) => {
        const Icon = icons[SECTION_ICON[section.title] ?? "docs"];
        return (
          <div key={section.title}>
            <p className="text-foreground mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <Icon className="text-subtle size-3.5" aria-hidden />
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.lessons.map((lesson) => {
                const href = lessonHref(lesson);
                const active = pathname === href;
                const isDone = completed.has(lesson.slug.join("/"));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-blue/15 text-foreground font-medium"
                          : "text-muted hover:bg-panel-hover hover:text-foreground",
                      )}
                    >
                      {isDone ? (
                        <icons.success className="text-green size-3.5 shrink-0" aria-label="Completed" />
                      ) : (
                        <span
                          className="border-border size-3.5 shrink-0 rounded-full border"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1">{lesson.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
