"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { useRegisterWorkspaceAction } from "@/components/app-shell/workspace-action";
import { EventsTimeline } from "@/components/events/events-timeline";
import { icons } from "@/components/icons";
import { ClusterExplorer } from "@/components/object-explorer/cluster-explorer";
import { ObjectDetails } from "@/components/object-explorer/object-details";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaygroundTemplate } from "@/lib/domain/types";
import { runCommandLine } from "@/lib/kube/command-runner";
import { takePlaygroundHandoff } from "@/lib/storage/playground-handoff";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";
import { useSimulator } from "@/features/problems/hooks/use-simulator";

import { usePlaygroundStore } from "../playground-store";
import { MultiFileEditor } from "./multi-file-editor";
import { ResourceSummary } from "./resource-summary";
import { TemplateSidebar } from "./template-sidebar";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-[calc(100%-1.5rem)]" /> },
);

const NAMESPACE = "default";
type RightTab = "explorer" | "events" | "resources";

export function PlaygroundWorkspace({ template }: { template: PlaygroundTemplate }) {
  const initTemplate = usePlaygroundStore((s) => s.initTemplate);
  const loadFiles = usePlaygroundStore((s) => s.loadFiles);
  useEffect(() => {
    initTemplate(template);
    // If a docs lab handed off manifests, load them into the editor (user applies).
    const handoff = takePlaygroundHandoff();
    if (handoff && Object.keys(handoff).length > 0) loadFiles(handoff);
  }, [template, initTemplate, loadFiles]);

  const sim = useSimulator(template);
  const [rightTab, setRightTab] = useState<RightTab>("explorer");
  const [selected, setSelected] = useState<SelectedObject | null>(null);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const runCommand = useCallback(
    async (line: string): Promise<TerminalRunResult> => {
      if (!sim.ready)
        return { output: "Cluster is still booting — try again in a moment.", isError: true };
      const result = await runCommandLine(line, {
        simulator: sim.simulator,
        namespace: NAMESPACE,
        files: usePlaygroundStore.getState().files,
      });
      return { output: result.output, isError: result.isError, clear: result.clear };
    },
    [sim.ready, sim.simulator],
  );

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      await sim.applyFiles(usePlaygroundStore.getState().files);
    } finally {
      setApplying(false);
    }
  }, [sim]);

  const handleReset = useCallback(async () => {
    await sim.reset();
    usePlaygroundStore.getState().resetToTemplate();
    setSelected(null);
  }, [sim]);

  const handleCopy = useCallback(async () => {
    const yaml = Object.values(usePlaygroundStore.getState().files).join("\n---\n");
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  useRegisterWorkspaceAction({
    label: "Apply Manifest",
    icon: "run",
    onRun: () => void handleApply(),
    pending: applying,
    disabled: !sim.ready,
  });

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] gap-3 overflow-x-auto p-3">
      {/* Left sidebar */}
      <Panel className="w-64 shrink-0">
        <PanelHeader title="Sandbox" icon={<icons.playground />} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <TemplateSidebar currentTemplateId={template.id} />
        </div>
      </Panel>

      {/* Center */}
      <div className="flex min-w-[420px] flex-1 flex-col gap-3">
        <Panel className="min-h-0 flex-[3]">
          <div className="border-border flex h-10 shrink-0 items-center justify-between border-b pr-2 pl-3">
            <span className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
              Workspace
            </span>
            <div className="flex items-center gap-1.5">
              <ToolbarButton onClick={() => void handleCopy()} disabled={!sim.ready}>
                <icons.yaml aria-hidden />
                {copied ? "Copied" : "Copy YAML"}
              </ToolbarButton>
              <ToolbarButton onClick={() => void handleReset()} disabled={!sim.ready}>
                <icons.reset aria-hidden />
                Reset
              </ToolbarButton>
              <ToolbarButton
                onClick={() => void handleApply()}
                disabled={applying || !sim.ready}
                primary
              >
                <icons.run aria-hidden />
                {applying ? "Applying…" : "Apply Manifests"}
              </ToolbarButton>
            </div>
          </div>
          <ErrorBoundary label="Editor">
            <MultiFileEditor />
          </ErrorBoundary>
        </Panel>

        <Panel className="min-h-0 flex-[2]">
          <PanelHeader
            title="Terminal"
            icon={<icons.terminal />}
            actions={<StatusPill status={sim.status} />}
          />
          <div className="min-h-0 flex-1">
            <ErrorBoundary label="Terminal">
              <XtermTerminal
                onCommand={runCommand}
                prompt="kube@sandbox:~$ "
                welcome={[`Template: ${template.title}`, "Type 'help' for commands."]}
              />
            </ErrorBoundary>
          </div>
        </Panel>
      </div>

      {/* Right */}
      <div className="flex w-[380px] shrink-0 flex-col gap-3 overflow-hidden">
        <Panel className="h-[280px] shrink-0">
          <PanelHeader title="Cluster Topology" icon={<icons.cluster />} />
          <PanelBody scroll={false} className="p-0">
            <ErrorBoundary label="Topology">
              <ServiceTopology
                snapshot={sim.snapshot}
                namespace={NAMESPACE}
                onSelect={setSelected}
              />
            </ErrorBoundary>
          </PanelBody>
        </Panel>

        <Panel className="min-h-0 flex-1">
          <div className="border-border flex h-10 shrink-0 items-center gap-1 border-b px-1.5">
            {(["explorer", "events", "resources"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={cn(
                  "h-8 rounded-md px-2.5 text-xs font-medium capitalize transition-colors",
                  rightTab === tab
                    ? "bg-panel-hover text-foreground"
                    : "text-subtle hover:text-muted",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {rightTab === "explorer" ? (
              <>
                <ClusterExplorer
                  snapshot={sim.snapshot}
                  namespace={NAMESPACE}
                  selected={selected}
                  onSelect={setSelected}
                />
                <div className="border-border border-t">
                  <ObjectDetails snapshot={sim.snapshot} selected={selected} />
                </div>
              </>
            ) : rightTab === "events" ? (
              <EventsTimeline events={sim.snapshot.events} namespace={NAMESPACE} />
            ) : (
              <ResourceSummary snapshot={sim.snapshot} />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  // "Simulator ready" (not bare "Ready") so it can't be misread as workload health.
  const label =
    status === "ready"
      ? "Simulator ready"
      : status === "error"
        ? "Simulator error"
        : "Simulator booting…";
  return (
    <span className="flex items-center gap-1.5 px-1 text-xs">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ready" ? "bg-green" : status === "error" ? "bg-red" : "bg-amber",
        )}
        aria-hidden
      />
      <span
        className={cn(
          status === "ready" ? "text-green" : status === "error" ? "text-red" : "text-amber",
        )}
      >
        {label}
      </span>
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
