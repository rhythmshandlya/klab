"use client";

import { useState } from "react";

import type { MissionStep, QuizOption } from "@/lib/domain/mission-types";
import { cn } from "@/lib/utils/cn";

/**
 * A graded checkpoint: a wrong answer shows its explanation and stays locked (the
 * learner cannot progress), but other options remain clickable so they can retry.
 * The correct answer shows its explanation and unlocks Next.
 */
export function CheckStep({
  step,
  onComplete,
}: {
  step: Extract<MissionStep, { kind: "check" }>;
  onComplete: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  const choose = (option: QuizOption) => {
    if (passed) return;
    setSelectedId(option.id);
    if (option.correct) {
      setPassed(true);
      onComplete();
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-foreground text-sm leading-relaxed">{step.quiz.question}</p>
      <div className="grid gap-2">
        {step.quiz.options.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <div key={option.id}>
              <button
                type="button"
                onClick={() => choose(option)}
                disabled={passed}
                className={cn(
                  "border-border bg-panel w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  isSelected && option.correct && "border-green/40 bg-green/5 text-green",
                  isSelected && !option.correct && "border-red/40 bg-red/5 text-red",
                  !isSelected && "hover:bg-panel-hover",
                )}
              >
                {option.text}
              </button>
              {isSelected ? (
                <p className="text-muted mt-1 pl-1 text-xs">{option.explain}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
