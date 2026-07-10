"use client";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { MissionStep } from "@/lib/domain/mission-types";

/** Closes out a mission: summary, takeaways, the commands used, and a finish button. */
export function DebriefStep({
  step,
  onComplete,
}: {
  step: Extract<MissionStep, { kind: "debrief" }>;
  onComplete: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-foreground text-sm leading-relaxed">{step.summary}</p>
      <ul className="grid gap-2">
        {step.takeaways.map((takeaway) => (
          <li key={takeaway} className="text-muted flex gap-2 text-sm">
            <icons.success className="text-green mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{takeaway}</span>
          </li>
        ))}
      </ul>
      {step.commands?.length ? (
        <div className="flex flex-wrap gap-2">
          {step.commands.map((command) => (
            <code
              key={command}
              className="border-border bg-terminal text-muted rounded border px-2 py-1 font-mono text-xs"
            >
              {command}
            </code>
          ))}
        </div>
      ) : null}
      <Button variant="primary" size="sm" onClick={onComplete}>
        <icons.arrowRight aria-hidden />
        Finish mission
      </Button>
    </div>
  );
}
