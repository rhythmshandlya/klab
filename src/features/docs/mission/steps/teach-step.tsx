"use client";

import { useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { MissionStep } from "@/lib/domain/mission-types";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { MissionDiagram } from "@/features/docs/mission/mission-diagram";

/**
 * Pure exposition: an idea (optionally illustrated) plus an acknowledgement button.
 * There is no way to be "wrong" here — the ack IS the action that unlocks Next.
 */
export function TeachStep({
  step,
  onComplete,
  snapshot,
  namespace,
}: {
  step: Extract<MissionStep, { kind: "teach" }>;
  onComplete: () => void;
  snapshot: ClusterSnapshot;
  namespace: string;
}) {
  const [acked, setAcked] = useState(false);

  const ack = () => {
    if (acked) return;
    setAcked(true);
    onComplete();
  };

  return (
    <div className="space-y-4">
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{step.idea}</p>
      {step.visual ? (
        <MissionDiagram spec={step.visual} snapshot={snapshot} namespace={namespace} />
      ) : null}
      <Button variant="primary" size="sm" onClick={ack} disabled={acked}>
        <icons.success aria-hidden />
        {step.ack ?? "Got it"}
      </Button>
    </div>
  );
}
