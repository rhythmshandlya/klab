"use client";

import { useEffect, useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Mission, MissionStep } from "@/lib/domain/mission-types";
import { mutateProgress } from "@/lib/storage/progress-store";
import type { UseSimulator } from "@/features/problems/hooks/use-simulator";
import { cn } from "@/lib/utils/cn";

import { CheckStep } from "./steps/check-step";
import { DebriefStep } from "./steps/debrief-step";
import { DoStep } from "./steps/do-step";
import { PredictStep } from "./steps/predict-step";
import { TeachStep } from "./steps/teach-step";

const NAMESPACE = "default";

function storageKey(mission: Mission): string {
  return `klab.mission.${mission.slug.join("/")}.step`;
}

function clampStepIndex(index: number, total: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

function readPersistedStepIndex(mission: Mission): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(storageKey(mission));
    if (raw === null) return 0;
    const parsed = Number.parseInt(raw, 10);
    return clampStepIndex(parsed, mission.steps.length);
  } catch {
    return 0;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Runs a single mission's steps end-to-end: cold open, step rail, gated steps, completion. */
export function MissionRunner({
  mission,
  sim,
  onMissionComplete,
}: {
  mission: Mission;
  sim: UseSimulator;
  onMissionComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(() =>
    clampStepIndex(readPersistedStepIndex(mission), mission.steps.length),
  );
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());

  const steps = mission.steps;
  const total = steps.length;
  const step: MissionStep | undefined = steps[stepIndex];
  const isLastStep = stepIndex === total - 1;
  const isCurrentComplete = step ? completed.has(step.id) : false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(mission), String(stepIndex));
    } catch {
      // best-effort — resume is a convenience, not a correctness requirement
    }
    // Only re-persist when the mission or step position actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission, stepIndex]);

  const finishMission = useMemo(
    () => () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(storageKey(mission));
        } catch {
          // best-effort
        }
      }
      mutateProgress({ kind: "completedLesson", slug: mission.slug.join("/") });
      onMissionComplete();
    },
    [mission, onMissionComplete],
  );

  const markComplete = (id: string) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const goNext = () => {
    if (!step || !completed.has(step.id)) return;
    if (isLastStep) return; // the last step's own UI drives completion
    setStepIndex((i) => clampStepIndex(i + 1, total));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (isLastStep) return;
      if (event.key === "Enter" || event.key === "ArrowRight") {
        if (step && completed.has(step.id)) {
          event.preventDefault();
          goNext();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, completed, isLastStep]);

  if (!step) return null;

  const renderStep = () => {
    switch (step.kind) {
      case "teach":
        return (
          <TeachStep
            step={step}
            onComplete={() => markComplete(step.id)}
            snapshot={sim.snapshot}
            namespace={NAMESPACE}
          />
        );
      case "predict":
        return (
          <PredictStep
            step={step}
            onComplete={() => markComplete(step.id)}
            snapshot={sim.snapshot}
            namespace={NAMESPACE}
          />
        );
      case "check":
        return <CheckStep step={step} onComplete={() => markComplete(step.id)} />;
      case "do":
        return (
          <DoStep
            step={step}
            sim={sim}
            onComplete={() => {
              markComplete(step.id);
            }}
          />
        );
      case "debrief":
        return (
          <DebriefStep
            step={step}
            onComplete={() => {
              markComplete(step.id);
              finishMission();
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Badge tone="achievement">{mission.section}</Badge>
          <span className="text-subtle text-xs font-medium">
            Step {stepIndex + 1} / {total}
          </span>
        </div>

        <div className="flex gap-1.5" role="presentation">
          {steps.map((s, i) => {
            const done = completed.has(s.id);
            const current = i === stepIndex;
            return (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  done && "bg-green",
                  !done && current && "bg-primary",
                  !done && !current && "bg-panel-elevated",
                )}
                aria-hidden
              />
            );
          })}
        </div>

        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {mission.coldOpen.goal}
          </h1>
          <p className="text-subtle mt-1 text-sm">{mission.coldOpen.clusterNote}</p>
          <p className="text-muted mt-3 text-xs font-medium tracking-[0.08em] uppercase">
            {mission.title}
          </p>
        </div>
      </div>

      <div className="border-border bg-panel mt-6 rounded-lg border p-5">{renderStep()}</div>

      {!isLastStep ? (
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={goNext} disabled={!isCurrentComplete}>
            Next
            <icons.arrowRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
