import Link from "next/link";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { CurriculumLessonPage } from "@/content/curriculum/model";

import { DocsContent } from "./docs-content";
import { DocsMobileNav } from "./docs-mobile-nav";
import { DocsSidebar } from "./docs-sidebar";
import { DocsToc } from "./docs-toc";
import { LessonComplete } from "./lesson-complete";
import { OpenInPlayground } from "./open-in-playground";

export function DocsPage({ page }: { page: CurriculumLessonPage }) {
  const { catalog, current, lesson, next, playgroundFiles, previous, rail } = page;

  return (
    <div className="mx-auto flex w-full max-w-[1520px]">
      <aside className="border-border hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
          <DocsSidebar catalog={catalog} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-5 lg:px-6">
        <div className="mb-4 lg:hidden">
          <DocsMobileNav catalog={catalog} sectionLabel={current.section} />
        </div>

        <div className="text-subtle flex items-center gap-2 text-xs">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Learn
          </Link>
          <span aria-hidden>/</span>
          <span>{current.section}</span>
          <span aria-hidden>/</span>
          <span className="text-foreground truncate">{current.title}</span>
        </div>

        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge tone="achievement" className="mb-3">
              {current.section}
            </Badge>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              {current.title}
            </h1>
            <p className="text-muted mt-2 max-w-3xl text-[15px] leading-relaxed">
              {current.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.concepts.slice(0, 6).map((c) => (
                <Badge key={c} tone="neutral">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <OpenInPlayground files={playgroundFiles} />
        </div>

        <div className="mt-8">
          <DocsContent lesson={lesson} />
        </div>

        <div className="mt-10">
          <LessonComplete lesson={current} next={next} />
        </div>

        <nav className="border-border mt-12 flex items-center justify-between gap-4 border-t pt-6">
          {previous ? (
            <Link href={previous.href} className="group flex flex-col text-left">
              <span className="text-subtle text-xs">Previous</span>
              <span className="text-muted group-hover:text-foreground text-sm font-medium">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.href} className="group flex flex-col text-right">
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
          <DocsToc rail={rail} />
        </div>
      </aside>
    </div>
  );
}
