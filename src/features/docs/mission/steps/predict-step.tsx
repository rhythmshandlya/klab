"use client";

import { useState } from "react";

import type { MissionStep, QuizOption } from "@/lib/domain/mission-types";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { MissionDiagram } from "@/features/docs/mission/mission-diagram";
import { cn } from "@/lib/utils/cn";

/**
 * Prediction is about engagement, not correctness: ANY choice reveals the answer and
 * unlocks Next, but the correct option is still highlighted so the learner can compare
 * their guess against reality.
 */
export function PredictStep({
  step,
  onComplete,
  snapshot,
  namespace,
}: {
  step: Extract<MissionStep, { kind: "predict" }>;
  onComplete: () => void;
  snapshot: ClusterSnapshot;
  namespace: string;
}) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const revealed = chosenId !== null;
  const { predict } = step;

  const choose = (option: QuizOption) => {
    if (revealed) return;
    setChosenId(option.id);
    onComplete();
  };

  return (
    <div className="space-y-4">
      <p className="text-foreground text-sm leading-relaxed">{predict.question}</p>
      {step.visual ? (
        <MissionDiagram spec={step.visual} snapshot={snapshot} namespace={namespace} />
      ) : null}
      <div className="grid gap-2">
        {predict.options.map((option) => {
          const isChosen = chosenId === option.id;
          return (
            <div key={option.id}>
              <button
                type="button"
                onClick={() => choose(option)}
                disabled={revealed}
                className={cn(
                  "border-border bg-panel w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  revealed && option.correct && "border-green/40 bg-green/5 text-green",
                  revealed && isChosen && !option.correct && "border-red/40 bg-red/5 text-red",
                  !revealed && "hover:bg-panel-hover",
                )}
              >
                {option.text}
              </button>
              {revealed && (isChosen || option.correct) ? (
                <p className="text-muted mt-1 pl-1 text-xs">{option.explain}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {revealed ? (
        <p className="text-foreground border-border bg-panel-elevated rounded-md border p-3 text-sm leading-relaxed">
          {predict.reveal}
        </p>
      ) : null}
    </div>
  );
}
