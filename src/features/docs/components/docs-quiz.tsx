"use client";

import { useMemo, useState } from "react";

import { icons } from "@/components/icons";
import type { DocsBlock } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

type QuizBlock = Extract<DocsBlock, { type: "quiz" }>;

export function DocsQuiz({ quiz }: { quiz: QuizBlock }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => quiz.options.find((option) => option.id === selectedId),
    [quiz.options, selectedId],
  );

  return (
    <div className="border-border bg-panel overflow-hidden rounded-lg border">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <icons.challenge className="text-amber size-4" aria-hidden />
        <div>
          <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
            Checkpoint quiz
          </p>
          <p className="text-foreground text-sm font-semibold">{quiz.question}</p>
        </div>
      </div>

      <div className="grid gap-2 p-4">
        {quiz.options.map((option) => {
          const isSelected = option.id === selectedId;
          const tone = !isSelected
            ? "border-border bg-panel-elevated text-muted hover:border-border-strong hover:text-foreground"
            : option.correct
              ? "border-green/50 bg-green/10 text-foreground"
              : "border-red/50 bg-red/10 text-foreground";
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(option.id)}
              className={cn(
                "flex min-h-11 items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                tone,
              )}
            >
              <span className="border-border bg-code text-subtle mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[11px]">
                {option.id.toUpperCase()}
              </span>
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          className={cn(
            "border-t px-4 py-3 text-sm",
            selected.correct
              ? "border-green/30 bg-green/5 text-muted"
              : "border-red/30 bg-red/5 text-muted",
          )}
        >
          <span className={cn("font-semibold", selected.correct ? "text-green" : "text-red")}>
            {selected.correct ? "Correct. " : "Not quite. "}
          </span>
          {selected.explanation}
        </div>
      ) : null}
    </div>
  );
}
