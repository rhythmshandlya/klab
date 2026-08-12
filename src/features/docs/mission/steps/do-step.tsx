"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { YamlEditor } from "@/components/editor/yaml-editor";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import type { UseSimulator } from "@/features/problems/hooks/use-simulator";
import { runCommandLine } from "@/lib/kube/command-runner";
import { deploymentReadyReplicas, isPodReady } from "@/lib/kube/kubectl/format";
import { evaluateDoCheck } from "@/lib/kube/mission-check";
import type { MissionStep } from "@/lib/domain/mission-types";
import { cn } from "@/lib/utils/cn";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-40" /> },
);

const NAMESPACE = "default";
type CompactPane = "editor" | "terminal" | "cluster";

const COMPACT_PANES: {
  id: CompactPane;
  label: string;
  icon: keyof typeof icons;
}[] = [
  { id: "editor", label: "Editor", icon: "yaml" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "cluster", label: "Cluster", icon: "cluster" },
];

/**
 * The hands-on step: an editor + terminal (mirroring `LiveLab`'s layout) against a
 * live simulator. Applying runs `evaluateDoCheck` against the resulting snapshot, but
 * readiness converges asynchronously (probes/controllers settle over subsequent
 * ticks), so we keep re-checking as new snapshots arrive after the first apply,
 * not just once right after the apply call resolves.
 */
export function DoStep({
  step,
  sim,
  onComplete,
  compact = false,
}: {
  step: Extract<MissionStep, { kind: "do" }>;
  sim: UseSimulator;
  onComplete: () => void;
  compact?: boolean;
}) {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(step.files.map((f) => [f.path, f.initialValue])),
  );
  const [activePath, setActivePath] = useState(step.files[0]?.path ?? "");
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [compactPane, setCompactPane] = useState<CompactPane>("cluster");
  // Sticky success: once the goal has been met we keep it met, even if a later
  // snapshot flickers during convergence.
  const [goalMet, setGoalMet] = useState(false);
  const completedRef = useRef(false);

  // The check outcome is a pure derivation of the latest snapshot: no state, so it
  // re-evaluates on every tick after the first apply (the cluster converges over
  // several ticks, not instantly).
  const result = useMemo(
    () => (hasApplied ? evaluateDoCheck(sim.snapshot, step.check, NAMESPACE) : null),
    [sim.snapshot, hasApplied, step.check],
  );

  // Latch the pass exactly once and notify the parent. Syncing a latch from an
  // external-store snapshot has to happen post-render; the guard makes it a
  // single transition, not a render loop.
  useEffect(() => {
    if (!result?.passed || completedRef.current) return;
    completedRef.current = true;
    setGoalMet(true);
    onComplete();
  }, [result, onComplete]);

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      await sim.applyFiles(files);
      setHasApplied(true);
    } finally {
      setApplying(false);
    }
  }, [sim, files]);

  const runCommand = useCallback(
    async (line: string): Promise<TerminalRunResult> => {
      if (!sim.ready) {
        return { output: "Cluster is still booting: try again in a moment.", isError: true };
      }
      const out = await runCommandLine(line, {
        simulator: sim.simulator,
        namespace: NAMESPACE,
        files,
      });
      return { output: out.output, isError: out.isError, clear: out.clear };
    },
    [sim.ready, sim.simulator, files],
  );

  const paths = Object.keys(files);

  // Live derivations for the side panel: mirrors LiveLab's right panel so the
  // diagram + metrics reflect the actual running cluster, not just a static goal card.
  const pods = useMemo(
    () => sim.snapshot.pods.filter((p) => (p.metadata?.namespace ?? "default") === NAMESPACE),
    [sim.snapshot.pods],
  );
  const deployment = sim.snapshot.deployments.find(
    (d) => (d.metadata?.namespace ?? "default") === NAMESPACE,
  );
  const readyPods = pods.filter(isPodReady).length;
  const desiredReplicas = deployment?.spec?.replicas ?? pods.length;
  const availableReplicas = deployment ? deploymentReadyReplicas(deployment) : readyPods;

  return (
    <div
      className={cn(
        "space-y-4 @5xl:grid @5xl:h-full @5xl:min-h-0 @5xl:grid-rows-[auto_minmax(0,1fr)_auto_auto] @5xl:gap-3 @5xl:space-y-0",
        compact &&
          "grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-2 space-y-0",
      )}
    >
      <div
        className={cn(
          "border-border bg-panel-elevated rounded-md border px-3 py-2.5",
          compact && "px-2.5 py-2",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="border-blue/40 bg-blue/10 text-blue flex size-6 shrink-0 items-center justify-center rounded-full border">
            <icons.yaml className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={cn("text-foreground text-sm font-medium", compact && "truncate text-xs")}>
              {step.goal}
            </p>
            {!compact ? (
              <>
                <p className="text-subtle mt-1 text-xs">
                  Edit the manifest, apply it, then use the terminal and live state to verify the
                  result.
                </p>
                {step.hint ? <p className="text-amber mt-1.5 text-xs">{step.hint}</p> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {compact ? (
        <div
          className="border-border bg-panel-elevated grid grid-cols-3 rounded-md border p-1"
          role="tablist"
          aria-label="Mission companion view"
        >
          {COMPACT_PANES.map((pane) => {
            const Icon = icons[pane.icon];
            return (
              <button
                key={pane.id}
                type="button"
                role="tab"
                aria-selected={compactPane === pane.id}
                onClick={() => setCompactPane(pane.id)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors",
                  compactPane === pane.id
                    ? "bg-panel-hover text-foreground"
                    : "text-subtle hover:text-muted",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {pane.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* min-w-0 on every column: Monaco and xterm report large intrinsic widths, and
          without it the grid lets the terminal crush the editor to a sliver. */}
      <div
        className={cn(
          "border-border bg-panel grid min-h-[54rem] grid-cols-1 overflow-hidden rounded-md border @5xl:h-full @5xl:min-h-0 @5xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(15rem,0.72fr)]",
          compact && "h-full min-h-0 grid-cols-1",
        )}
        data-mission-workspace
        data-compact={compact || undefined}
      >
        <div
          className={cn(
            "border-border flex min-h-[20rem] min-w-0 flex-col border-b @5xl:min-h-0 @5xl:border-r @5xl:border-b-0",
            compact && "min-h-0 border-0",
            compact && compactPane !== "editor" && "hidden",
          )}
        >
          <div
            className="border-border flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2"
            role="tablist"
            aria-label="Mission files"
          >
            {paths.map((path) => (
              <button
                key={path}
                type="button"
                role="tab"
                aria-selected={path === activePath}
                onClick={() => setActivePath(path)}
                className={cn(
                  "h-8 shrink-0 rounded px-2 font-mono text-[11px]",
                  path === activePath
                    ? "bg-panel-hover text-foreground"
                    : "text-subtle hover:text-muted",
                )}
              >
                {path}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1" role="tabpanel">
            {activePath ? (
              <YamlEditor
                path={`mission/${step.id}/${activePath}`}
                value={files[activePath] ?? ""}
                minimap={false}
                onChange={(value) => setFiles((f) => ({ ...f, [activePath]: value }))}
              />
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "bg-terminal flex min-h-[20rem] min-w-0 flex-col border-b @5xl:min-h-0 @5xl:border-r @5xl:border-b-0",
            compact && "min-h-0 border-0",
            compact && compactPane !== "terminal" && "hidden",
          )}
        >
          <div className="border-border flex h-10 shrink-0 items-center gap-1.5 border-b px-3">
            <icons.terminal className="text-green size-3.5" aria-hidden />
            <span className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
              Terminal
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <XtermTerminal
              onCommand={runCommand}
              welcome={["Type a command and press Enter.", "Try: kubectl get pods"]}
            />
          </div>
        </div>

        {/* Live cluster state: the diagram IS the running cluster, updating as changes apply. */}
        <div
          className={cn(
            "bg-panel-elevated flex min-h-[14rem] min-w-0 flex-col overflow-hidden @5xl:min-h-0",
            compact && "min-h-0",
            compact && compactPane !== "cluster" && "hidden",
          )}
        >
          <div className="border-border grid grid-cols-3 gap-2 border-b p-3">
            <Metric label="Desired" value={desiredReplicas} />
            <Metric
              label="Available"
              value={availableReplicas}
              tone={availableReplicas > 0 ? "green" : "amber"}
            />
            <Metric label="Ready" value={readyPods} tone={readyPods > 0 ? "green" : "amber"} />
          </div>
          <div className="min-h-0 flex-1 p-3">
            <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Topology
            </p>
            <div className="h-[calc(100%-1.5rem)] min-h-40">
              <ErrorBoundary label="Topology">
                <ServiceTopology snapshot={sim.snapshot} namespace={NAMESPACE} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      <div className="border-border bg-panel-elevated flex min-h-11 flex-wrap items-center gap-2 rounded-md border px-3 py-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void apply()}
          disabled={applying || !sim.ready || goalMet}
        >
          <icons.run aria-hidden />
          {applying ? "Applying..." : "Apply changes"}
        </Button>
        {result ? (
          <span className={cn("text-xs", result.passed ? "text-green" : "text-amber")}>
            {result.detail}
          </span>
        ) : null}
      </div>

      {goalMet ? (
        <div className="border-green/30 bg-green/5 rounded-md border p-3">
          <p className="text-green flex items-center gap-2 text-sm font-semibold">
            <icons.success aria-hidden />
            Goal met
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">{step.debrief}</p>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "amber";
}) {
  const toneClass = {
    blue: "text-blue border-blue/25 bg-blue/5",
    green: "text-green border-green/25 bg-green/5",
    amber: "text-amber border-amber/25 bg-amber/5",
  }[tone];
  return (
    <div className={cn("rounded-md border px-2 py-1.5", toneClass)}>
      <p className="tabnums text-base leading-none font-semibold">{value}</p>
      <p className="text-muted mt-1 truncate text-[10px]">{label}</p>
    </div>
  );
}
