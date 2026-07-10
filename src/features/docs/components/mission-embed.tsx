"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { accumulatedSeedManifests, getMissionBySlug } from "@/content/missions";
import { DoStep } from "@/features/docs/mission/steps/do-step";
import { useSimulator } from "@/features/problems/hooks/use-simulator";
import type { Mission, MissionStep } from "@/lib/domain/mission-types";
import { mutateProgress } from "@/lib/storage/progress-store";
import { cn } from "@/lib/utils/cn";

type DoStepSpec = Extract<MissionStep, { kind: "do" }>;
type DebriefSpec = Extract<MissionStep, { kind: "debrief" }>;

/**
 * A mission embedded in the reading flow: a stakes-bearing card between sections.
 * Starting it opens a full workspace overlay (editor + terminal + live topology)
 * against a cluster seeded with everything earlier missions built — reading stays
 * uninterrupted, and the hands-on work gets real room.
 */
export function MissionEmbed({ missionSlug }: { missionSlug: string }) {
  const [open, setOpen] = useState(false);
  const mission = getMissionBySlug(missionSlug.split("/"));
  if (!mission) return null;

  return (
    <>
      <div className="border-blue/35 bg-blue/5 rounded-md border p-5">
        <div className="text-blue flex items-center gap-2">
          <icons.run className="size-4" aria-hidden />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Mission</span>
        </div>
        <h4 className="text-foreground mt-2 text-base font-semibold">{mission.coldOpen.goal}</h4>
        <p className="text-muted mt-1 text-sm leading-relaxed">{mission.coldOpen.clusterNote}</p>
        <Button variant="primary" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          <icons.run aria-hidden />
          Start mission
        </Button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content
            aria-label={`Mission: ${mission.title}`}
            className="anim-content border-border-strong bg-panel fixed top-1/2 left-1/2 z-50 flex h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
          >
            <Dialog.Title asChild>
              <VisuallyHidden>{mission.title}</VisuallyHidden>
            </Dialog.Title>
            {open ? <LiveMission mission={mission} /> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function LiveMission({ mission }: { mission: Mission }) {
  // Seed = section seed + every earlier mission's do-step files, so the cluster the
  // reader lands in reflects the course so far (documented approximation in
  // accumulatedSeedManifests).
  const bootSpec = useMemo(
    () => ({ files: [], initialManifests: accumulatedSeedManifests(mission) }),
    [mission],
  );
  const sim = useSimulator(bootSpec);
  const doSteps = mission.steps.filter((s): s is DoStepSpec => s.kind === "do");
  const wrap = mission.steps.find((s): s is DebriefSpec => s.kind === "debrief");
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const done = doSteps.length > 0 && doSteps.every((s) => completed.has(s.id));

  const complete = (id: string) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      // Doing the hands-on work is what completes the lesson (grow-only, synced).
      if (doSteps.every((s) => next.has(s.id))) {
        mutateProgress({ kind: "completedLesson", slug: mission.slug.join("/") });
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-blue flex items-center gap-2">
            <icons.run className="size-4" aria-hidden />
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Mission</span>
          </div>
          <p className="text-foreground mt-0.5 truncate text-sm font-semibold">
            {mission.coldOpen.goal}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={sim.status} />
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close mission"
              className="text-subtle hover:text-foreground hover:bg-panel-hover rounded-md p-1.5 transition-colors"
            >
              <icons.close className="size-4" aria-hidden />
            </button>
          </Dialog.Close>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {sim.ready ? (
          <div className="space-y-4">
            {doSteps.map((step) => (
              <DoStep key={step.id} step={step} sim={sim} onComplete={() => complete(step.id)} />
            ))}
            {done && wrap ? (
              <div className="border-green/30 bg-green/5 rounded-md border p-4">
                <p className="text-green flex items-center gap-2 text-sm font-semibold">
                  <icons.success aria-hidden />
                  Mission complete
                </p>
                <p className="text-muted mt-1 text-sm leading-relaxed">{wrap.summary}</p>
                <ul className="mt-3 space-y-2">
                  {wrap.takeaways.map((item) => (
                    <li key={item} className="text-muted flex gap-2 text-sm leading-relaxed">
                      <span className="text-green mt-0.5" aria-hidden>
                        -
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Dialog.Close asChild>
                  <Button variant="secondary" size="sm" className="mt-4">
                    Back to reading
                  </Button>
                </Dialog.Close>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <StatusPill status={sim.status} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "ready"
      ? "Cluster ready"
      : status === "error"
        ? "Cluster error"
        : "Cluster booting...";
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ready" ? "bg-green" : status === "error" ? "bg-red" : "bg-amber",
        )}
        aria-hidden
      />
      <span
        className={
          status === "ready" ? "text-green" : status === "error" ? "text-red" : "text-amber"
        }
      >
        {label}
      </span>
    </span>
  );
}
