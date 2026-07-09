"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import type { DocsLesson } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export function DocsToc({ lesson }: { lesson: DocsLesson }) {
  const headings = lesson.content.flatMap((b) =>
    b.type === "heading" ? [{ id: b.id, text: b.text }] : [],
  );
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

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
    <div className="space-y-6 p-4 text-sm">
      {headings.length > 0 ? (
        <div>
          <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            On this page
          </p>
          <ul className="space-y-1">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={cn(
                    "block border-l-2 pl-3 transition-colors",
                    activeId === h.id
                      ? "border-blue text-foreground"
                      : "text-subtle hover:text-muted border-transparent",
                  )}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lesson.labs.length > 0 ? (
        <div>
          <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Related labs
          </p>
          <ul className="space-y-1">
            {lesson.labs.map((lab) => (
              <li key={lab.id} className="text-muted flex items-center gap-2">
                <icons.docsInteractive className="text-purple size-3.5" aria-hidden />
                {lab.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lesson.relatedLevelSlug ? (
        <div>
          <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Related problem
          </p>
          <Link
            href={`/problems/${lesson.relatedLevelSlug}`}
            className="border-border bg-panel text-foreground hover:border-border-strong hover:bg-panel-hover flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <icons.problems className="text-blue size-4" aria-hidden />
            Try the incident lab
          </Link>
        </div>
      ) : null}
    </div>
  );
}
