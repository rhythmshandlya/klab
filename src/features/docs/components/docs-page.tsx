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
    <div className="mx-auto flex w-full max-w-[1520px]">
      <aside className="border-border hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsSidebar />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-5 lg:px-6">
        <div className="text-subtle flex items-center gap-2 text-xs">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          <span aria-hidden>/</span>
          <span>{lesson.section}</span>
          <span aria-hidden>/</span>
          <span className="text-foreground truncate">{lesson.title}</span>
        </div>

        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge tone="achievement" className="mb-3">
              {lesson.section}
            </Badge>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              {lesson.title}
            </h1>
            <p className="text-muted mt-2 max-w-3xl text-[15px] leading-relaxed">
              {lesson.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lesson.concepts.slice(0, 6).map((c) => (
                <Badge key={c} tone="neutral">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <Link
            href="/playground"
            className="border-blue/40 bg-blue/10 text-foreground hover:bg-blue/15 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
          >
            <icons.playground className="text-blue size-4" aria-hidden />
            Open in Playground
          </Link>
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

      <aside className="border-border hidden w-80 shrink-0 border-l xl:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsToc lesson={lesson} />
        </div>
      </aside>
    </div>
  );
}
