"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { useRegisterWorkspaceAction } from "@/components/app-shell/workspace-action";
import { DiffView } from "@/components/editor/diff-editor";
import { EventsTimeline } from "@/components/events/events-timeline";
import { icons } from "@/components/icons";
import { LogsView } from "@/components/logs/logs-view";
import { ClusterExplorer } from "@/components/object-explorer/cluster-explorer";
import { ObjectDetails } from "@/components/object-explorer/object-details";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  ResizableGroup,
  ResizableHandle,
  ResizablePane,
  usePersistedLayout,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { YamlEditor } from "@/components/editor/yaml-editor";
import type { Hint, ProblemLevel } from "@/lib/domain/types";
import { runCommandLine } from "@/lib/kube/command-runner";
import { matchEvidence, type InvestigationSignal } from "@/lib/kube/evidence";
import { isPodReady, readyEndpointCount } from "@/lib/kube/kubectl/format";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import { mutateProgress } from "@/lib/storage/progress-store";
import { cn } from "@/lib/utils/cn";

import { useSimulator } from "../hooks/use-simulator";
import { useLevelStore, type CenterTab } from "../level-store";
import { EvidenceBoard } from "./evidence-board";
import { FailingChecks } from "./failing-checks";
import { HintsCard } from "./hints-card";
import { IncidentBrief } from "./incident-brief";
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

/** Local calendar day (YYYY-MM-DD) for the solved intent — streaks are per local day. */
function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Control-plane namespaces are simulator machinery, not part of any level's puzzle. */
function isWorkloadNamespace(namespace: string | undefined): boolean {
  return !(namespace ?? "default").startsWith("kube-");
}

/** Pick the most diagnostically interesting broken object for auto-selection. */
function findBrokenObject(
  snapshot: ClusterSnapshot,
): { kind: string; name: string; namespace: string } | null {
  const notReadyPod = snapshot.pods.find(
    (p) => !isPodReady(p) && p.metadata?.name && isWorkloadNamespace(p.metadata.namespace),
  );
  if (notReadyPod?.metadata?.name) {
    return {
      kind: "Pod",
      name: notReadyPod.metadata.name,
      namespace: notReadyPod.metadata.namespace ?? "default",
    };
  }
  const emptyService = snapshot.services.find(
    (s) =>
      s.metadata?.name &&
      isWorkloadNamespace(s.metadata.namespace) &&
      readyEndpointCount(s, snapshot.endpointSlices) === 0,
  );
  if (emptyService?.metadata?.name) {
    return {
      kind: "Service",
      name: emptyService.metadata.name,
      namespace: emptyService.metadata.namespace ?? "default",
    };
  }
  const strugglingDeployment = snapshot.deployments.find(
    (d) =>
      d.metadata?.name &&
      isWorkloadNamespace(d.metadata.namespace) &&
      (d.status?.readyReplicas ?? 0) < (d.spec?.replicas ?? 0),
  );
  if (strugglingDeployment?.metadata?.name) {
    return {
      kind: "Deployment",
      name: strugglingDeployment.metadata.name,
      namespace: strugglingDeployment.metadata.namespace ?? "default",
    };
  }
  return null;
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
  const checks = useLevelStore((s) => s.checks);
  const setChecks = useLevelStore((s) => s.setChecks);
  const setSolved = useLevelStore((s) => s.setSolved);
  const solved = useLevelStore((s) => s.solved);
  const revealedHintIds = useLevelStore((s) => s.revealedHintIds);

  const sim = useSimulator(level);
  const [validationOpen, setValidationOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validating, setValidating] = useState(false);
  const [refreshingChecks, setRefreshingChecks] = useState(false);

  // Persisted, user-resizable pane layouts (drag the separators; arrow keys work too).
  const columnsLayout = usePersistedLayout("klab:layout:level-workspace:columns");
  const centerLayout = usePersistedLayout("klab:layout:level-workspace:center");
  const rightLayout = usePersistedLayout("klab:layout:level-workspace:right");
  const explorerLayout = usePersistedLayout("klab:layout:level-workspace:explorer");

  const terminalRunnerRef = useRef<((line: string) => void) | null>(null);
  const autoSelectedRef = useRef(false);
  const attemptedRef = useRef(false);
  const checksTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // When the level opened, for measuring time-to-solve on each submission. Set in an
  // effect (not during render) so the render stays pure; the effect runs before any solve.
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [level.slug]);

  const markAttempted = useCallback(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    mutateProgress({ kind: "attempted", slug: level.slug });
  }, [level.slug]);

  const collectSignals = useCallback(
    (signals: InvestigationSignal[]) => {
      const matched = matchEvidence(level.evidenceRules, signals);
      if (matched.length > 0) addEvidence(matched);
    },
    [level.evidenceRules, addEvidence],
  );

  /** Quietly evaluate the level's checks (no dialog, no solve) for the status card. */
  const refreshChecks = useCallback(async () => {
    if (!sim.ready) return;
    setRefreshingChecks(true);
    try {
      setChecks(await sim.validate(level.validators));
    } finally {
      setRefreshingChecks(false);
    }
  }, [sim, level.validators, setChecks]);

  /** Refresh now and again after the controllers have had time to reconcile. */
  const scheduleChecks = useCallback(
    (delays: number[] = [400, 2500]) => {
      for (const delay of delays) {
        checksTimersRef.current.push(setTimeout(() => void refreshChecks(), delay));
      }
    },
    [refreshChecks],
  );
  useEffect(() => {
    const timers = checksTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // First quiet check once the cluster is up and the broken state has settled.
  const bootedOnceRef = useRef(false);
  useEffect(() => {
    if (sim.ready && !bootedOnceRef.current) {
      bootedOnceRef.current = true;
      scheduleChecks([1200, 4000]);
    }
  }, [sim.ready, scheduleChecks]);

  // Auto-select the most relevant broken object once, so the details panel is never
  // an empty "select something" placeholder while the incident is live.
  useEffect(() => {
    if (autoSelectedRef.current || selected !== null) return;
    const broken = findBrokenObject(sim.snapshot);
    if (broken) {
      autoSelectedRef.current = true;
      select(broken);
    }
  }, [sim.snapshot, selected, select]);

  const runCommand = useCallback(
    async (line: string): Promise<TerminalRunResult> => {
      if (!sim.simulator || !sim.ready) {
        return { output: "Cluster is still booting — try again in a moment.", isError: true };
      }
      markAttempted();
      const result = await runCommandLine(line, {
        simulator: sim.simulator,
        namespace: NAMESPACE,
        files: useLevelStore.getState().files,
      });
      collectSignals(result.signals);
      return { output: result.output, isError: result.isError, clear: result.clear };
    },
    [sim.simulator, sim.ready, collectSignals, markAttempted],
  );

  const handleProbe = useCallback(
    async (url: string) => {
      markAttempted();
      const result = await sim.probe(url);
      collectSignals([{ type: "probe", path: safePath(url), status: result.status }]);
      return result;
    },
    [sim, collectSignals, markAttempted],
  );

  const handleApply = useCallback(async () => {
    setApplying(true);
    markAttempted();
    try {
      const result = await sim.applyFiles(useLevelStore.getState().files);
      if (!result.ok) {
        setValidation({ passed: false, results: [] });
      }
      scheduleChecks();
    } finally {
      setApplying(false);
    }
  }, [sim, setValidation, scheduleChecks, markAttempted]);

  const handleReset = useCallback(async () => {
    await sim.reset();
    useLevelStore.getState().resetFiles();
    select(null);
    autoSelectedRef.current = false;
    setChecks(null);
    scheduleChecks([1200, 4000]);
  }, [sim, select, setChecks, scheduleChecks]);

  const handleValidate = useCallback(async () => {
    if (!sim.ready) return;
    setValidating(true);
    try {
      const report = await sim.validate(level.validators);
      setValidation(report);
      setChecks(report);
      setValidationOpen(true);
      // Record the attempt as a full submission (history → real success rates).
      mutateProgress({
        kind: "submission",
        slug: level.slug,
        passed: report.passed,
        checksTotal: report.results.length,
        checksPassed: report.results.filter((r) => r.passed).length,
        durationMs: Date.now() - startedAtRef.current,
        hintsRevealed: revealedHintIds.length,
      });
      if (report.passed) {
        setSolved(true);
        mutateProgress({ kind: "solved", slug: level.slug, xp: level.xp, day: todayLocal() });
      }
    } finally {
      setValidating(false);
    }
  }, [
    sim,
    level.validators,
    level.slug,
    level.xp,
    revealedHintIds.length,
    setValidation,
    setChecks,
    setSolved,
  ]);

  const handleRevealHint = useCallback(
    (hint: Hint) => {
      revealHint(hint.id);
      mutateProgress({
        kind: "revealHint",
        slug: level.slug,
        hintId: hint.id,
        penalty: hint.xpPenalty,
      });
    },
    [revealHint, level.slug],
  );

  // Route-specific nav primary action + ⌘R (Cmd+Shift+R still reloads). The nav is
  // the ONLY Run Validation button — the editor toolbar applies/diffs/resets.
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

  // Namespaces that actually hold workload objects (multi-namespace levels).
  // Control-plane namespaces (kube-*) are simulator machinery and stay hidden.
  const workspaceNamespaces = useMemo(() => {
    const set = new Set<string>([NAMESPACE]);
    for (const object of [
      ...sim.snapshot.pods,
      ...sim.snapshot.services,
      ...sim.snapshot.deployments,
      ...sim.snapshot.replicaSets,
    ]) {
      const ns = object.metadata?.namespace ?? "default";
      if (isWorkloadNamespace(ns)) set.add(ns);
    }
    return [...set].sort((a, b) =>
      a === NAMESPACE ? -1 : b === NAMESPACE ? 1 : a.localeCompare(b),
    );
  }, [sim.snapshot]);

  /** Substitute `<pod>` in a quick command with the most relevant live workload pod. */
  const resolveQuickCommand = useCallback(
    (command: string): string | null => {
      if (!/<pod>/.test(command)) return command;
      const pods = sim.snapshot.pods.filter(
        (p) => p.metadata?.name && isWorkloadNamespace(p.metadata.namespace),
      );
      const target = pods.find((p) => !isPodReady(p)) ?? pods[0];
      const name = target?.metadata?.name;
      return name ? command.replaceAll("<pod>", name) : null;
    },
    [sim.snapshot.pods],
  );

  const runQuickCommand = useCallback(
    (command: string) => {
      const resolved = resolveQuickCommand(command);
      if (!resolved) return;
      setCenterTab("terminal");
      // The terminal mounts lazily; give it a tick when switching tabs.
      setTimeout(() => terminalRunnerRef.current?.(resolved), 50);
    },
    [resolveQuickCommand, setCenterTab],
  );

  const hintPenalty = level.hints
    .filter((h) => revealedHintIds.includes(h.id))
    .reduce((sum, h) => sum + h.xpPenalty, 0);
  const netXp = Math.max(0, level.xp - hintPenalty);

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-x-auto p-3">
      <ResizableGroup
        orientation="horizontal"
        id="level-columns"
        defaultLayout={columnsLayout.defaultLayout}
        onLayoutChanged={columnsLayout.onLayoutChanged}
        className="h-full min-w-[1080px]"
      >
        {/* Left rail — resizable; one scroll container, cards keep their natural height. */}
        <ResizablePane
          id="rail-left"
          defaultSize="23%"
          minSize="240px"
          maxSize="42%"
          className="h-full"
        >
          <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1 pb-1">
            <div className="shrink-0">
              <IncidentBrief />
            </div>
            <div className="shrink-0">
              <FailingChecks onRefresh={() => void refreshChecks()} refreshing={refreshingChecks} />
            </div>
            <div className="shrink-0">
              <EvidenceBoard />
            </div>
            <div className="shrink-0">
              <HintsCard onReveal={handleRevealHint} />
            </div>
            {/* XP is a footnote during debugging, not a panel (UX: prioritize investigation). */}
            <p className="text-subtle flex shrink-0 items-center gap-1.5 px-1 text-xs">
              <icons.xp className="text-purple size-3.5" aria-hidden />
              Worth <span className="tabnums text-foreground font-medium">{netXp} XP</span>
              {hintPenalty > 0 ? (
                <span className="text-amber">(−{hintPenalty} from hints)</span>
              ) : null}
              {solved ? (
                <Badge tone="success">
                  <icons.trophy aria-hidden />
                  Solved
                </Badge>
              ) : null}
            </p>
          </div>
        </ResizablePane>

        <ResizableHandle orientation="vertical" aria-label="Resize incident rail" />

        {/* Center column — vertical split so the editor height is adjustable. */}
        <ResizablePane id="center" minSize="28%" className="h-full">
          <ResizableGroup
            orientation="vertical"
            id="level-center"
            defaultLayout={centerLayout.defaultLayout}
            onLayoutChanged={centerLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane id="center-top" defaultSize="52%" minSize="18%" className="h-full">
              <Panel className="h-full">
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
                  <div className="flex items-center gap-2">
                    <ChallengeStatus
                      failing={checks ? checks.results.filter((r) => !r.passed).length : null}
                      total={level.validators.length}
                    />
                    <SimulatorStatus status={sim.status} />
                  </div>
                </div>

                {/* Quick commands: one-click investigation starters (beginner training wheels). */}
                {centerTab === "terminal" ? (
                  <div className="border-border flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2">
                    <span className="text-subtle text-[11px] font-medium tracking-wide uppercase">
                      Try:
                    </span>
                    {level.quickCommands.map((command) => {
                      const resolvable = resolveQuickCommand(command) !== null;
                      return (
                        <button
                          key={command}
                          type="button"
                          disabled={!sim.ready || !resolvable}
                          onClick={() => runQuickCommand(command)}
                          className="border-border bg-panel-elevated text-muted hover:border-border-strong hover:text-foreground rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors disabled:opacity-40"
                        >
                          {command}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="min-h-0 flex-1">
                  {centerTab === "terminal" ? (
                    <ErrorBoundary label="Terminal">
                      <XtermTerminal
                        onCommand={runCommand}
                        registerRunner={(run) => {
                          terminalRunnerRef.current = run;
                        }}
                        welcome={[
                          "klab simulated shell — type 'help' for commands.",
                          "Cluster: local (webernetes)",
                          `Try: ${level.quickCommands[0] ?? "kubectl get pods"}`,
                        ]}
                      />
                    </ErrorBoundary>
                  ) : centerTab === "logs" ? (
                    <LogsView snapshot={sim.snapshot} />
                  ) : centerTab === "events" ? (
                    <div className="h-full overflow-auto">
                      <EventsTimeline events={sim.snapshot.events} namespace={NAMESPACE} />
                    </div>
                  ) : centerTab === "network" ? (
                    <NetworkProbe onProbe={handleProbe} presets={level.probeTargets} />
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
            </ResizablePane>

            <ResizableHandle orientation="horizontal" aria-label="Resize editor height" />

            {/* Editor */}
            <ResizablePane id="center-editor" minSize="18%" className="h-full">
              <Panel className="h-full">
                <PanelHeader
                  title={activeFilePath || "editor"}
                  icon={<icons.yaml />}
                  actions={
                    <div className="flex items-center gap-1.5">
                      <ToolbarButton
                        onClick={() => void handleApply()}
                        disabled={applying || !sim.ready}
                        primary
                      >
                        <icons.run aria-hidden />
                        {applying ? "Applying…" : "Apply Changes"}
                      </ToolbarButton>
                      <ToolbarButton onClick={() => setCenterTab("diff")}>
                        <icons.diff aria-hidden />
                        Show Diff
                      </ToolbarButton>
                      <ToolbarButton onClick={() => void handleReset()} disabled={!sim.ready}>
                        <icons.reset aria-hidden />
                        Reset
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
            </ResizablePane>
          </ResizableGroup>
        </ResizablePane>

        <ResizableHandle orientation="vertical" aria-label="Resize cluster rail" />

        {/* Right rail — explorer/details and topology, each resizable. */}
        <ResizablePane
          id="rail-right"
          defaultSize="26%"
          minSize="260px"
          maxSize="45%"
          className="h-full"
        >
          <ResizableGroup
            orientation="vertical"
            id="level-right"
            defaultLayout={rightLayout.defaultLayout}
            onLayoutChanged={rightLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane id="cluster" minSize="30%" className="h-full">
              <Panel className="h-full">
                <PanelHeader title="Cluster Explorer" icon={<icons.cluster />} />
                <ResizableGroup
                  orientation="vertical"
                  id="level-explorer"
                  defaultLayout={explorerLayout.defaultLayout}
                  onLayoutChanged={explorerLayout.onLayoutChanged}
                  className="min-h-0 flex-1"
                >
                  <ResizablePane
                    id="explorer-tree"
                    defaultSize="55%"
                    minSize="20%"
                    className="h-full"
                  >
                    <div className="h-full overflow-auto">
                      <ClusterExplorer
                        snapshot={sim.snapshot}
                        namespaces={workspaceNamespaces}
                        selected={selected}
                        onSelect={select}
                      />
                    </div>
                  </ResizablePane>
                  <ResizableHandle orientation="horizontal" aria-label="Resize object details" />
                  <ResizablePane id="explorer-details" minSize="20%" className="h-full">
                    <div className="h-full min-h-0 overflow-hidden">
                      <ObjectDetails snapshot={sim.snapshot} selected={selected} />
                    </div>
                  </ResizablePane>
                </ResizableGroup>
              </Panel>
            </ResizablePane>

            <ResizableHandle orientation="horizontal" aria-label="Resize topology" />

            <ResizablePane id="topology" defaultSize="30%" minSize="15%" className="h-full">
              <Panel className="h-full">
                <PanelHeader title="Service Topology" icon={<icons.service />} />
                <PanelBody scroll={false} className="p-0">
                  <ErrorBoundary label="Topology">
                    <ServiceTopology
                      snapshot={sim.snapshot}
                      namespaces={workspaceNamespaces}
                      onSelect={select}
                    />
                  </ErrorBoundary>
                </PanelBody>
              </Panel>
            </ResizablePane>
          </ResizableGroup>
        </ResizablePane>
      </ResizableGroup>

      <ValidationDialog
        open={validationOpen}
        onOpenChange={setValidationOpen}
        report={validation}
        level={level}
      />
    </div>
  );
}

/** The simulator's own lifecycle — deliberately labeled so it can't be read as cluster health. */
function SimulatorStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    booting: { label: "Simulator booting…", className: "text-amber", dot: "bg-amber" },
    ready: { label: "Simulator ready", className: "text-subtle", dot: "bg-green" },
    error: { label: "Simulator error", className: "text-red", dot: "bg-red" },
    idle: { label: "Simulator idle", className: "text-subtle", dot: "bg-amber" },
  };
  const entry = map[status] ?? map.idle!;
  return (
    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className={cn("size-1.5 rounded-full", entry.dot)} aria-hidden />
      <span className={entry.className}>{entry.label}</span>
    </span>
  );
}

/** The challenge's live health — the thing the learner is actually fixing. */
function ChallengeStatus({ failing, total }: { failing: number | null; total: number }) {
  if (failing === null) {
    return (
      <span className="border-border text-subtle rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
        Challenge: assessing…
      </span>
    );
  }
  if (failing === 0) {
    return (
      <span className="border-green/40 bg-green/10 text-green rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
        Challenge passing — run validation
      </span>
    );
  }
  return (
    <span className="border-red/40 bg-red/10 text-red rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      Challenge failing · {failing}/{total} checks
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
