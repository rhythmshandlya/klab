"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { MissionRun } from "@/content/curriculum/model";
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
 * against a cluster seeded with everything earlier missions built: reading stays
 * uninterrupted, and the hands-on work gets real room.
 */
export function MissionWorkspaceCard({ run }: { run: MissionRun }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const { initialManifests, mission } = run;

  const close = () => {
    setOpen(false);
    setMinimized(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open || minimized) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, minimized]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (open && !minimized) requestAnimationFrame(() => workspaceRef.current?.focus());
  }, [open, minimized]);

  return (
    <>
      <div className="border-blue/35 bg-blue/5 rounded-md border p-5">
        <div className="text-blue flex items-center gap-2">
          <icons.run className="size-4" aria-hidden />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Mission</span>
        </div>
        <h4 className="text-foreground mt-2 text-base font-semibold">{mission.coldOpen.goal}</h4>
        <p className="text-muted mt-1 text-sm leading-relaxed">{mission.coldOpen.clusterNote}</p>
        <Button
          ref={triggerRef}
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={() => {
            setMinimized(false);
            setOpen(true);
          }}
        >
          <icons.run aria-hidden />
          Start mission
        </Button>
      </div>

      {open
        ? createPortal(
            <>
              {!minimized ? (
                <div
                  className="anim-overlay fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                  data-mission-overlay
                  aria-hidden
                />
              ) : null}
              <section
                ref={workspaceRef}
                role={minimized ? "complementary" : "dialog"}
                aria-modal={minimized ? undefined : true}
                aria-label={
                  minimized ? `Mission companion: ${mission.title}` : `Mission: ${mission.title}`
                }
                tabIndex={-1}
                data-mission-mode={minimized ? "companion" : "workspace"}
                className={cn(
                  "border-border-strong bg-panel fixed z-50 flex flex-col overflow-hidden border shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)] outline-none",
                  minimized
                    ? "right-3 bottom-3 h-[min(38rem,calc(100dvh-5rem))] w-[min(32rem,calc(100vw-1.5rem))] rounded-xl"
                    : "anim-content top-1/2 left-1/2 h-dvh w-screen max-w-[1440px] -translate-x-1/2 -translate-y-1/2 sm:h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:rounded-xl",
                )}
              >
                <LiveMission
                  mission={mission}
                  initialManifests={initialManifests}
                  minimized={minimized}
                  onMinimizedChange={setMinimized}
                  onClose={close}
                />
              </section>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function LiveMission({
  mission,
  initialManifests,
  minimized,
  onMinimizedChange,
  onClose,
}: {
  mission: Mission;
  initialManifests: readonly string[];
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
}) {
  // Seed = section seed + every earlier mission's do-step files, so the cluster the
  // reader lands in reflects the course so far (documented approximation in
  // accumulatedSeedManifests).
  const bootSpec = useMemo(
    () => ({ files: [], initialManifests: [...initialManifests] }),
    [initialManifests],
  );
  const sim = useSimulator(bootSpec);
  const doSteps = mission.steps.filter((s): s is DoStepSpec => s.kind === "do");
  const wrap = mission.steps.find((s): s is DebriefSpec => s.kind === "debrief");
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  // Ref mirrors `completed` so the side effect (progress write) stays OUT of the
  // state updater: updaters must be pure, and mutateProgress re-renders other
  // components (TopNav XP) which React forbids mid-render.
  const completedRef = useRef<Set<string>>(new Set());
  const done = doSteps.length > 0 && doSteps.every((s) => completed.has(s.id));

  const complete = (id: string) => {
    if (completedRef.current.has(id)) return;
    completedRef.current.add(id);
    setCompleted(new Set(completedRef.current));
    // Doing the hands-on work is what completes the lesson (grow-only, synced).
    if (doSteps.every((s) => completedRef.current.has(s.id))) {
      mutateProgress({ kind: "completedLesson", slug: mission.slug.join("/") });
    }
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="border-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-blue text-[10px] font-semibold tracking-[0.12em] uppercase">
            Mission · {mission.title}
          </p>
          <h2 className="text-foreground mt-0.5 truncate text-sm font-semibold">
            {mission.coldOpen.goal}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={sim.status} />
          <button
            type="button"
            onClick={() => onMinimizedChange(!minimized)}
            aria-label={minimized ? "Expand mission" : "Minimize mission"}
            className="border-border bg-panel-elevated text-muted hover:bg-panel-hover hover:text-foreground inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors"
          >
            {minimized ? (
              <Maximize2 className="size-3.5" aria-hidden />
            ) : (
              <Minimize2 className="size-3.5" aria-hidden />
            )}
            <span>{minimized ? "Expand" : "Read alongside"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mission"
            className="text-subtle hover:text-foreground hover:bg-panel-hover inline-flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <icons.close className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 p-3",
          minimized ? "overflow-hidden" : "overflow-y-auto sm:p-4 @5xl:overflow-hidden",
        )}
      >
        {sim.ready ? (
          <div
            className={cn(
              "space-y-4 @5xl:grid @5xl:h-full @5xl:min-h-0 @5xl:grid-rows-[minmax(0,1fr)_auto] @5xl:gap-3 @5xl:space-y-0",
              minimized && "grid h-full min-h-0 grid-rows-[minmax(0,1fr)] space-y-0",
            )}
          >
            <div className={cn("@5xl:h-full @5xl:min-h-0", minimized && "h-full min-h-0")}>
              {doSteps.map((step) => (
                <DoStep
                  key={step.id}
                  step={step}
                  sim={sim}
                  compact={minimized}
                  onComplete={() => complete(step.id)}
                />
              ))}
            </div>
            {!minimized && done && wrap ? (
              <details className="border-green/30 bg-green/5 group rounded-md border">
                <summary className="text-green flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden">
                  <icons.success aria-hidden />
                  <span>Mission complete</span>
                  <span className="text-muted ml-auto text-xs font-medium">View recap</span>
                  <icons.chevronDown
                    className="text-muted size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-green/20 border-t px-4 py-3">
                  <p className="text-muted text-sm leading-relaxed">{wrap.summary}</p>
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
                  <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>
                    Back to reading
                  </Button>
                </div>
              </details>
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
