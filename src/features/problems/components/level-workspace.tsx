"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { useRegisterWorkspaceAction } from "@/components/app-shell/workspace-action";
import { DiffView } from "@/components/editor/diff-editor";
import { EventsTimeline } from "@/components/events/events-timeline";
import { icons } from "@/components/icons";
import { ClusterExplorer } from "@/components/object-explorer/cluster-explorer";
import { ObjectDetails } from "@/components/object-explorer/object-details";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { YamlEditor } from "@/components/editor/yaml-editor";
import type { Hint, ProblemLevel } from "@/lib/domain/types";
import { runCommandLine } from "@/lib/kube/command-runner";
import { matchEvidence, type InvestigationSignal } from "@/lib/kube/evidence";
import {
  loadProgress,
  recordHintPenalty,
  recordSolved,
  saveProgress,
} from "@/lib/storage/local-progress";
import { cn } from "@/lib/utils/cn";

import { useSimulator } from "../hooks/use-simulator";
import { useLevelStore, type CenterTab } from "../level-store";
import { EvidenceBoard } from "./evidence-board";
import { HintsCard } from "./hints-card";
import { IncidentBrief } from "./incident-brief";
import { LevelProgress } from "./level-progress";
import { NetworkProbe } from "./network-probe";
import { ValidationDialog } from "./validation-dialog";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-[calc(100%-1.5rem)]" /> },
);

const NAMESPACE = "default";

const CENTER_TABS: { id: CenterTab; label: string; icon: keyof typeof icons }[] = [
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "logs", label: "Logs", icon: "logs" },
  { id: "events", label: "Events", icon: "events" },
  { id: "network", label: "Network", icon: "cluster" },
  { id: "diff", label: "Diff", icon: "diff" },
];

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function LevelWorkspace({ level }: { level: ProblemLevel }) {
  const initLevel = useLevelStore((s) => s.initLevel);
  useEffect(() => {
    initLevel(level);
  }, [level, initLevel]);

  const files = useLevelStore((s) => s.files);
  const activeFilePath = useLevelStore((s) => s.activeFilePath);
  const setFile = useLevelStore((s) => s.setFile);
  const centerTab = useLevelStore((s) => s.centerTab);
  const setCenterTab = useLevelStore((s) => s.setCenterTab);
  const selected = useLevelStore((s) => s.selected);
  const select = useLevelStore((s) => s.select);
  const addEvidence = useLevelStore((s) => s.addEvidence);
  const revealHint = useLevelStore((s) => s.revealHint);
  const validation = useLevelStore((s) => s.validation);
  const setValidation = useLevelStore((s) => s.setValidation);
  const setSolved = useLevelStore((s) => s.setSolved);

  const sim = useSimulator(level);
  const [validationOpen, setValidationOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validating, setValidating] = useState(false);

  const collectSignals = useCallback(
    (signals: InvestigationSignal[]) => {
      const matched = matchEvidence(level.evidenceRules, signals);
      if (matched.length > 0) addEvidence(matched);
    },
    [level.evidenceRules, addEvidence],
  );

  const runCommand = useCallback(
    async (line: string): Promise<TerminalRunResult> => {
      if (!sim.simulator || !sim.ready) {
        return { output: "Cluster is still booting — try again in a moment.", isError: true };
      }
      const result = await runCommandLine(line, {
        simulator: sim.simulator,
        namespace: NAMESPACE,
        files: useLevelStore.getState().files,
      });
      collectSignals(result.signals);
      return { output: result.output, isError: result.isError, clear: result.clear };
    },
    [sim.simulator, sim.ready, collectSignals],
  );

  const handleProbe = useCallback(
    async (url: string) => {
      const result = await sim.probe(url);
      collectSignals([{ type: "probe", path: safePath(url), status: result.status }]);
      return result;
    },
    [sim, collectSignals],
  );

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      const result = await sim.applyFiles(useLevelStore.getState().files);
      if (!result.ok) {
        setValidation({ passed: false, results: [] });
      }
    } finally {
      setApplying(false);
    }
  }, [sim, setValidation]);

  const handleReset = useCallback(async () => {
    await sim.reset();
    useLevelStore.getState().resetFiles();
    select(null);
  }, [sim, select]);

  const handleValidate = useCallback(async () => {
    if (!sim.ready) return;
    setValidating(true);
    try {
      const report = await sim.validate(level.validators);
      setValidation(report);
      setValidationOpen(true);
      if (report.passed) {
        setSolved(true);
        saveProgress(recordSolved(loadProgress(), level.slug, level.xp));
      }
    } finally {
      setValidating(false);
    }
  }, [sim, level.validators, level.slug, level.xp, setValidation, setSolved]);

  const handleRevealHint = useCallback(
    (hint: Hint) => {
      revealHint(hint.id);
      saveProgress(recordHintPenalty(loadProgress(), level.slug, hint.xpPenalty));
    },
    [revealHint, level.slug],
  );

  // Route-specific nav primary action + ⌘R (Cmd+Shift+R still reloads).
  useRegisterWorkspaceAction({
    label: "Run Validation",
    icon: "validate",
    shortcut: "⌘R",
    onRun: () => void handleValidate(),
    pending: validating,
    disabled: !sim.ready,
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        void handleValidate();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleValidate]);

  const activeFile = level.files.find((f) => f.path === activeFilePath);
  const logsText = useMemo(() => {
    const pod = sim.snapshot.pods.find((p) => (p.metadata?.namespace ?? "default") === NAMESPACE);
    if (!pod?.metadata?.name || !sim.simulator) return "";
    return sim.simulator
      .getLogs(NAMESPACE, pod.metadata.name)
      .map((l) => l.message)
      .join("\n");
  }, [sim.snapshot, sim.simulator]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] gap-3 overflow-x-auto p-3">
      {/* Left column */}
      <div className="flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto">
        <IncidentBrief />
        <HintsCard onReveal={handleRevealHint} />
        <EvidenceBoard />
        <LevelProgress />
      </div>

      {/* Center column */}
      <div className="flex min-w-[420px] flex-1 flex-col gap-3">
        <Panel className="min-h-0 flex-1">
          <div className="border-border flex h-10 shrink-0 items-center justify-between gap-2 border-b pr-2">
            <div className="flex items-center">
              {CENTER_TABS.map((tab) => {
                const Icon = icons[tab.icon];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCenterTab(tab.id)}
                    className={cn(
                      "flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                      centerTab === tab.id
                        ? "border-blue text-foreground"
                        : "text-muted hover:text-foreground border-transparent",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <StatusPill status={sim.status} />
          </div>
          <div className="min-h-0 flex-1">
            {centerTab === "terminal" ? (
              <ErrorBoundary label="Terminal">
                <XtermTerminal
                  onCommand={runCommand}
                  welcome={[
                    "klab simulated shell — type 'help' for commands.",
                    "Cluster: local (webernetes)",
                  ]}
                />
              </ErrorBoundary>
            ) : centerTab === "logs" ? (
              <pre className="text-muted h-full overflow-auto p-3 font-mono text-xs">
                {logsText || "No logs yet. Apply a workload and pods will start logging."}
              </pre>
            ) : centerTab === "events" ? (
              <div className="h-full overflow-auto">
                <EventsTimeline events={sim.snapshot.events} namespace={NAMESPACE} />
              </div>
            ) : centerTab === "network" ? (
              <NetworkProbe onProbe={handleProbe} />
            ) : (
              <ErrorBoundary label="Diff">
                <DiffView
                  original={activeFile?.initialValue ?? ""}
                  modified={files[activeFilePath] ?? ""}
                />
              </ErrorBoundary>
            )}
          </div>
        </Panel>

        {/* Editor */}
        <Panel className="min-h-0 flex-1">
          <PanelHeader
            title={activeFilePath || "editor"}
            icon={<icons.yaml />}
            actions={
              <div className="flex items-center gap-1.5">
                <ToolbarButton onClick={() => void handleApply()} disabled={applying || !sim.ready}>
                  <icons.run aria-hidden />
                  {applying ? "Applying…" : "Apply Changes"}
                </ToolbarButton>
                <ToolbarButton onClick={() => void handleReset()} disabled={!sim.ready}>
                  <icons.reset aria-hidden />
                  Reset
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => void handleValidate()}
                  disabled={validating || !sim.ready}
                  primary
                >
                  <icons.validate aria-hidden />
                  {validating ? "Validating…" : "Run Validation"}
                </ToolbarButton>
              </div>
            }
          />
          <div className="min-h-0 flex-1">
            <ErrorBoundary label="Editor">
              <YamlEditor
                path={activeFilePath || "manifest.yaml"}
                value={files[activeFilePath] ?? ""}
                onChange={(value) => setFile(activeFilePath, value)}
              />
            </ErrorBoundary>
          </div>
        </Panel>
      </div>

      {/* Right column */}
      <div className="flex w-[380px] shrink-0 flex-col gap-3 overflow-hidden">
        <Panel className="min-h-0 flex-1">
          <PanelHeader title="Cluster Explorer" icon={<icons.cluster />} />
          <div className="grid min-h-0 flex-1 grid-rows-2">
            <div className="border-border min-h-0 overflow-auto border-b">
              <ClusterExplorer
                snapshot={sim.snapshot}
                namespace={NAMESPACE}
                selected={selected}
                onSelect={select}
              />
            </div>
            <div className="min-h-0 overflow-hidden">
              <ObjectDetails snapshot={sim.snapshot} selected={selected} />
            </div>
          </div>
        </Panel>
        <Panel className="h-[280px] shrink-0">
          <PanelHeader title="Service Topology" icon={<icons.service />} />
          <PanelBody scroll={false} className="p-0">
            <ErrorBoundary label="Topology">
              <ServiceTopology snapshot={sim.snapshot} namespace={NAMESPACE} onSelect={select} />
            </ErrorBoundary>
          </PanelBody>
        </Panel>
      </div>

      <ValidationDialog
        open={validationOpen}
        onOpenChange={setValidationOpen}
        report={validation}
        level={level}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    booting: { label: "Booting…", className: "text-amber" },
    ready: { label: "Ready", className: "text-green" },
    error: { label: "Error", className: "text-red" },
    idle: { label: "Idle", className: "text-subtle" },
  };
  const entry = map[status] ?? map.idle!;
  return (
    <span className="flex items-center gap-1.5 px-2 text-xs">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ready" ? "bg-green" : status === "error" ? "bg-red" : "bg-amber",
        )}
        aria-hidden
      />
      <span className={entry.className}>{entry.label}</span>
    </span>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 [&_svg]:size-3.5",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-panel-elevated text-muted hover:bg-panel-hover hover:text-foreground border",
      )}
    >
      {children}
    </button>
  );
}
