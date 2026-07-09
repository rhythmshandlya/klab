import Link from "next/link";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { DOCS_NAV, lessonHref } from "@/content/docs";
import type { DocsLesson } from "@/lib/domain/types";

import { DocsContent } from "./docs-content";
import { DocsSidebar } from "./docs-sidebar";
import { DocsToc } from "./docs-toc";

const ORDERED = DOCS_NAV.flatMap((s) => s.lessons);

export function DocsPage({ lesson }: { lesson: DocsLesson }) {
  const index = ORDERED.findIndex((l) => l.slug.join("/") === lesson.slug.join("/"));
  const prev = index > 0 ? ORDERED[index - 1] : undefined;
  const next = index >= 0 && index < ORDERED.length - 1 ? ORDERED[index + 1] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsSidebar />
        </div>
      </aside>

      <main className="min-w-0 flex-1 py-8">
        <p className="text-subtle text-[11px] font-medium tracking-[0.12em] uppercase">
          {lesson.section}
        </p>
        <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
          {lesson.title}
        </h1>
        <p className="text-muted mt-2 max-w-2xl text-[15px] leading-relaxed">
          {lesson.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lesson.concepts.map((c) => (
            <Badge key={c} tone="neutral">
              {c}
            </Badge>
          ))}
        </div>

        <div className="mt-8">
          <DocsContent lesson={lesson} />
        </div>

        <nav className="border-border mt-12 flex items-center justify-between gap-4 border-t pt-6">
          {prev ? (
            <Link href={lessonHref(prev)} className="group flex flex-col text-left">
              <span className="text-subtle text-xs">Previous</span>
              <span className="text-muted group-hover:text-foreground text-sm font-medium">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={lessonHref(next)} className="group flex flex-col text-right">
              <span className="text-subtle flex items-center justify-end gap-1 text-xs">
                Next <icons.service className="size-3" aria-hidden />
              </span>
              <span className="text-muted group-hover:text-foreground text-sm font-medium">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsToc lesson={lesson} />
        </div>
      </aside>
    </div>
  );
}
