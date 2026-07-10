"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { YamlEditor } from "@/components/editor/yaml-editor";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import type { UseSimulator } from "@/features/problems/hooks/use-simulator";
import { runCommandLine } from "@/lib/kube/command-runner";
import { evaluateDoCheck } from "@/lib/kube/mission-check";
import type { MissionStep } from "@/lib/domain/mission-types";
import { cn } from "@/lib/utils/cn";

const NAMESPACE = "default";

/**
 * The hands-on step: an editor + terminal (mirroring `LiveLab`'s layout) against a
 * live simulator. Applying runs `evaluateDoCheck` against the resulting snapshot, but
 * readiness converges asynchronously (probes/controllers settle over subsequent
 * ticks) — so we keep re-checking as new snapshots arrive after the first apply,
 * not just once right after the apply call resolves.
 */
export function DoStep({
  step,
  sim,
  onComplete,
}: {
  step: Extract<MissionStep, { kind: "do" }>;
  sim: UseSimulator;
  onComplete: () => void;
}) {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(step.files.map((f) => [f.path, f.initialValue])),
  );
  const [activePath, setActivePath] = useState(step.files[0]?.path ?? "");
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; detail: string } | null>(null);
  const [goalMet, setGoalMet] = useState(false);
  const completedRef = useRef(false);

  const evaluate = useCallback(() => {
    const outcome = evaluateDoCheck(sim.snapshot, step.check, NAMESPACE);
    setResult(outcome);
    if (outcome.passed) {
      setGoalMet(true);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }
  }, [sim.snapshot, step.check, onComplete]);

  // Re-evaluate every time a new snapshot arrives, once the learner has applied at
  // least once — the cluster converges over several ticks, not instantly.
  useEffect(() => {
    if (!hasApplied) return;
    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.snapshot, hasApplied]);

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
        return { output: "Cluster is still booting — try again in a moment.", isError: true };
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

  return (
    <div className="space-y-4">
      <div className="border-border bg-panel-elevated rounded-md border p-3">
        <p className="text-foreground text-sm font-medium">{step.goal}</p>
        {step.hint ? <p className="text-subtle mt-1 text-xs">{step.hint}</p> : null}
      </div>

      <div className="border-border bg-panel grid min-h-[24rem] grid-cols-1 overflow-hidden rounded-md border lg:grid-cols-2">
        <div className="border-border flex min-h-[16rem] flex-col border-b lg:border-r lg:border-b-0">
          <div className="border-border flex h-9 shrink-0 items-center gap-1 border-b px-2">
            {paths.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setActivePath(path)}
                className={cn(
                  "h-7 rounded px-2 font-mono text-[11px]",
                  path === activePath
                    ? "bg-panel-hover text-foreground"
                    : "text-subtle hover:text-muted",
                )}
              >
                {path}
              </button>
            ))}
          </div>
          <div className="min-h-[14rem] flex-1">
            {activePath ? (
              <YamlEditor
                path={`mission/${step.id}/${activePath}`}
                value={files[activePath] ?? ""}
                onChange={(value) => setFiles((f) => ({ ...f, [activePath]: value }))}
              />
            ) : null}
          </div>
        </div>

        <div className="bg-terminal flex min-h-[16rem] flex-col">
          <div className="border-border flex h-9 shrink-0 items-center gap-1.5 border-b px-3">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
