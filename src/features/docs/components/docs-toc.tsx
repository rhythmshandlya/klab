"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { DOCS_LESSONS, lessonHref } from "@/content/docs";
import type { DocsLesson } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export function DocsToc({ lesson }: { lesson: DocsLesson }) {
  const headings = lesson.content.flatMap((b) =>
    b.type === "heading" ? [{ id: b.id, text: b.text }] : [],
  );
  const takeaways = useMemo(
    () => lesson.content.find((b) => b.type === "takeaways")?.items ?? [],
    [lesson.content],
  );
  const related = useMemo(() => {
    const key = lesson.slug.join("/");
    const concepts = new Set(lesson.concepts);
    return DOCS_LESSONS.filter(
      (l) => l.slug.join("/") !== key && l.concepts.some((c) => concepts.has(c)),
    ).slice(0, 4);
  }, [lesson]);
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  return (
    <div className="space-y-6 px-4 text-sm">
      {headings.length > 0 ? (
        <RailSection title="On this page">
          <ul className="space-y-1">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={cn(
                    "block border-l-2 py-0.5 pl-3 transition-colors",
                    activeId === h.id
                      ? "border-blue text-blue"
                      : "text-subtle hover:text-muted border-transparent",
                  )}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </RailSection>
      ) : null}

      {lesson.labs.length > 0 ? (
        <RailSection title="Try it">
          <div className="border-border bg-panel rounded-md border p-4">
            <div className="text-green flex items-center gap-2">
              <icons.docsInteractive className="size-4" aria-hidden />
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
                Interactive lab
              </span>
            </div>
            <p className="text-foreground mt-2 text-base font-semibold">{lesson.labs[0]?.title}</p>
            <p className="text-muted mt-1 text-sm leading-relaxed">{lesson.labs[0]?.prompt}</p>
            <a
              href={`#lab-${lesson.labs[0]?.id}`}
              className="border-blue/50 bg-blue/10 text-foreground hover:bg-blue/15 mt-4 flex h-8 items-center justify-between rounded-md border px-3 text-sm transition-colors"
            >
              Start lab
              <icons.arrowRight className="text-blue size-4" aria-hidden />
            </a>
          </div>
        </RailSection>
      ) : null}

      {related.length > 0 ? (
        <RailSection title="Related lessons">
          <div className="grid gap-2">
            {related.map((l) => (
              <Link
                key={l.slug.join("/")}
                href={lessonHref(l)}
                className="border-border bg-panel hover:bg-panel-hover hover:border-border-strong text-foreground flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors"
              >
                <span className="min-w-0 truncate">{l.title}</span>
                <icons.arrowRight className="text-subtle size-3.5 shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </RailSection>
      ) : null}

      {takeaways.length > 0 ? (
        <RailSection title="Quick note">
          <div className="border-border bg-panel rounded-md border p-4">
            <p className="text-amber flex items-center gap-2 text-sm font-semibold">
              <icons.challenge className="size-4" aria-hidden />
              Remember this
            </p>
            <p className="text-muted mt-2 text-sm leading-relaxed">{takeaways[0]}</p>
          </div>
        </RailSection>
      ) : null}

      {lesson.relatedLevelSlug ? (
        <RailSection title="Related problem">
          <Link
            href={`/problems/${lesson.relatedLevelSlug}`}
            className="border-border bg-panel text-foreground hover:border-border-strong hover:bg-panel-hover flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <icons.problems className="text-blue size-4" aria-hidden />
            Try the incident lab
          </Link>
        </RailSection>
      ) : null}

      {lesson.sources?.length ? (
        <RailSection title="Official references">
          <ul className="space-y-1.5">
            {lesson.sources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-foreground block rounded-md py-1 text-sm transition-colors"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </RailSection>
      ) : null}

      <div className="border-border flex items-center justify-between border-t pt-5">
        {feedback ? (
          <span className="text-subtle text-xs">
            {feedback === "up" ? "Thanks for the feedback!" : "Thanks — we'll keep improving this."}
          </span>
        ) : (
          <>
            <span className="text-subtle text-xs">Was this helpful?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Mark helpful"
                onClick={() => setFeedback("up")}
                className="border-border bg-panel hover:bg-panel-hover hover:text-green text-muted rounded-md border p-2 transition-colors"
              >
                <icons.success className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Needs improvement"
                onClick={() => setFeedback("down")}
                className="border-border bg-panel hover:bg-panel-hover hover:text-amber text-muted rounded-md border p-2 transition-colors"
              >
                <icons.warning className="size-4" aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}
