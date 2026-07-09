"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { icons, type IconName } from "@/components/icons";
import { DOCS_NAV, lessonHref } from "@/content/docs";
import { cn } from "@/lib/utils/cn";

const SECTION_ICON: Record<string, IconName> = {
  Foundations: "docs",
  Workloads: "deployment",
  Networking: "service",
  "Observability & Debugging": "terminal",
  Operations: "config",
  "Real Incidents": "warning",
};

export function DocsSidebar() {
  const pathname = usePathname();
  const totalLessons = DOCS_NAV.reduce((sum, section) => sum + section.lessons.length, 0);

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
            {totalLessons} lessons with live labs, quizzes, and incident walkthroughs.
          </p>
          <div className="bg-panel-elevated mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-blue h-full w-1/3 rounded-full" />
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
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-blue/15 text-foreground font-medium"
                          : "text-muted hover:bg-panel-hover hover:text-foreground",
                      )}
                    >
                      {lesson.title}
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
