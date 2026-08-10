"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { EventsTimeline } from "@/components/events/events-timeline";
import { icons } from "@/components/icons";
import { ClusterExplorer } from "@/components/object-explorer/cluster-explorer";
import { ObjectDetails } from "@/components/object-explorer/object-details";
import { XtermTerminal, type TerminalRunResult } from "@/components/terminal/xterm-terminal";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  ResizableGroup,
  ResizableHandle,
  ResizablePane,
  usePersistedLayout,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaygroundTemplate } from "@/lib/domain/types";
import { runCommandLine } from "@/lib/kube/command-runner";
import type { SavedLab } from "@/lib/labs/contracts";
import { takePlaygroundHandoff } from "@/lib/storage/playground-handoff";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";
import { useSimulator } from "@/features/problems/hooks/use-simulator";

import { useLabsStore } from "../labs-store";
import { usePlaygroundStore } from "../playground-store";
import { MultiFileEditor } from "./multi-file-editor";
import { NetworkActivity } from "./network-activity";
import { ResourceSummary } from "./resource-summary";
import { SaveLabDialog } from "./save-lab-dialog";
import { TemplateSidebar } from "./template-sidebar";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-[calc(100%-1.5rem)]" /> },
);

const NAMESPACE = "default";
type RightTab = "explorer" | "network" | "events" | "resources";
const RIGHT_TABS = ["explorer", "network", "events", "resources"] as const;

export function PlaygroundWorkspace({
  template,
  lab,
}: {
  template: PlaygroundTemplate;
  /** When set, the workspace edits this saved lab (files come from it, Save updates it). */
  lab?: SavedLab;
}) {
  const initTemplate = usePlaygroundStore((s) => s.initTemplate);
  const loadFiles = usePlaygroundStore((s) => s.loadFiles);
  useEffect(() => {
    initTemplate(template);
    if (lab) {
      loadFiles(lab.files);
      return;
    }
    // If a docs lab handed off manifests, load them into the editor (user applies).
    const handoff = takePlaygroundHandoff();
    if (handoff && Object.keys(handoff).length > 0) loadFiles(handoff);
  }, [template, lab, initTemplate, loadFiles]);

  const sim = useSimulator(template);
  // Pane sizes survive reloads, same mechanism as the problems workspace.
  const columnsLayout = usePersistedLayout("klab:layout:playground-workspace:columns");
  const centerLayout = usePersistedLayout("klab:layout:playground-workspace:center");
  const rightLayout = usePersistedLayout("klab:layout:playground-workspace:right");
  const [rightTab, setRightTab] = useState<RightTab>("explorer");
  const [selected, setSelected] = useState<SelectedObject | null>(null);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [labSaveState, setLabSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const router = useRouter();
  const createLab = useLabsStore((s) => s.create);
  const updateLab = useLabsStore((s) => s.update);

  // "Save" on an open lab persists the current files back into it.
  const handleSaveLab = useCallback(async () => {
    if (!lab) return;
    setLabSaveState("saving");
    try {
      await updateLab(lab.id, { files: usePlaygroundStore.getState().files });
      setLabSaveState("saved");
      setTimeout(() => setLabSaveState("idle"), 1500);
    } catch {
      setLabSaveState("error");
    }
  }, [lab, updateLab]);

  // "Save as lab" (from a template) / "Save as…" (fork of a lab) creates and opens it.
  const handleCreateLab = useCallback(
    async (name: string) => {
      const created = await createLab({
        name,
        templateId: template.id,
        files: usePlaygroundStore.getState().files,
      });
      router.push(`/playground/lab/${created.id}`);
    },
    [createLab, template.id, router],
  );

  // Topology spans every user namespace so e.g. the Namespaces template's team-a
  // pod is visible; control-plane namespaces stay hidden.
  const userNamespaces = useMemo(() => {
    const names = sim.snapshot.namespaces
      .map((n) => n.metadata?.name ?? "")
      .filter((n) => n !== "" && !n.startsWith("kube-"));
    return names.length > 0 ? names : [NAMESPACE];
  }, [sim.snapshot.namespaces]);

  const togglePause = useCallback(() => {
    if (!sim.ready) return;
    if (sim.simulator.isPaused()) {
      sim.simulator.resume();
      setPaused(false);
    } else {
      sim.simulator.pause();
      setPaused(true);
    }
  }, [sim.ready, sim.simulator]);

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
    if (lab) {
      // In a lab, Reset returns to the lab's last-saved files, not the template.
      const latest = useLabsStore.getState().labs.find((l) => l.id === lab.id);
      usePlaygroundStore.getState().loadFiles(latest?.files ?? lab.files);
    } else {
      usePlaygroundStore.getState().resetToTemplate();
    }
    setSelected(null);
    setPaused(false);
  }, [sim, lab]);

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

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-x-auto p-3">
      <ResizableGroup
        orientation="horizontal"
        id="playground-columns"
        defaultLayout={columnsLayout.defaultLayout}
        onLayoutChanged={columnsLayout.onLayoutChanged}
        className="h-full min-w-[1080px]"
      >
        {/* Left sidebar */}
        <ResizablePane
          id="rail-left"
          defaultSize="19%"
          minSize="220px"
          maxSize="36%"
          className="h-full"
        >
          <Panel className="h-full">
            <PanelHeader title="Sandbox" icon={<icons.playground />} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TemplateSidebar currentTemplateId={template.id} currentLabId={lab?.id} />
            </div>
          </Panel>
        </ResizablePane>

        <ResizableHandle orientation="vertical" aria-label="Resize sandbox sidebar" />

        {/* Center column — vertical split so the editor/terminal ratio is adjustable. */}
        <ResizablePane id="center" minSize="32%" className="h-full">
          <ResizableGroup
            orientation="vertical"
            id="playground-center"
            defaultLayout={centerLayout.defaultLayout}
            onLayoutChanged={centerLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane id="center-editor" defaultSize="60%" minSize="20%" className="h-full">
              <Panel className="h-full">
                <div className="border-border flex h-10 shrink-0 items-center justify-between border-b pr-2 pl-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="text-subtle shrink-0 text-[11px] font-semibold tracking-[0.08em] uppercase">
                      {lab ? "Lab" : "Workspace"}
                    </span>
                    {lab ? (
                      <span className="text-foreground truncate text-xs font-medium">
                        {lab.name}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {lab ? (
                      <>
                        <ToolbarButton
                          onClick={() => void handleSaveLab()}
                          disabled={!sim.ready || labSaveState === "saving"}
                        >
                          <icons.bookmark aria-hidden />
                          {labSaveState === "saving"
                            ? "Saving…"
                            : labSaveState === "saved"
                              ? "Saved"
                              : labSaveState === "error"
                                ? "Retry save"
                                : "Save"}
                        </ToolbarButton>
                        <ToolbarButton
                          onClick={() => setSaveDialogOpen(true)}
                          disabled={!sim.ready}
                        >
                          <icons.yaml aria-hidden />
                          Save as…
                        </ToolbarButton>
                      </>
                    ) : (
                      <ToolbarButton onClick={() => setSaveDialogOpen(true)} disabled={!sim.ready}>
                        <icons.bookmark aria-hidden />
                        Save as lab
                      </ToolbarButton>
                    )}
                    <ToolbarButton onClick={() => void handleCopy()} disabled={!sim.ready}>
                      <icons.yaml aria-hidden />
                      {copied ? "Copied" : "Copy YAML"}
                    </ToolbarButton>
                    <ToolbarButton onClick={togglePause} disabled={!sim.ready}>
                      {paused ? <icons.run aria-hidden /> : <icons.pause aria-hidden />}
                      {paused ? "Resume" : "Pause"}
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
            </ResizablePane>

            <ResizableHandle orientation="horizontal" aria-label="Resize terminal height" />

            <ResizablePane id="center-terminal" minSize="18%" className="h-full">
              <Panel className="h-full">
                <PanelHeader
                  title="Terminal"
                  icon={<icons.terminal />}
                  actions={<StatusPill status={paused ? "paused" : sim.status} />}
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
            </ResizablePane>
          </ResizableGroup>
        </ResizablePane>

        <ResizableHandle orientation="vertical" aria-label="Resize cluster rail" />

        {/* Right rail — vertical split between topology and the inspector tabs. */}
        <ResizablePane
          id="rail-right"
          defaultSize="26%"
          minSize="280px"
          maxSize="45%"
          className="h-full"
        >
          <ResizableGroup
            orientation="vertical"
            id="playground-right"
            defaultLayout={rightLayout.defaultLayout}
            onLayoutChanged={rightLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane id="topology" defaultSize="34%" minSize="15%" className="h-full">
              <Panel className="h-full">
                <PanelHeader title="Cluster Topology" icon={<icons.cluster />} />
                <PanelBody scroll={false} className="p-0">
                  <ErrorBoundary label="Topology">
                    <ServiceTopology
                      snapshot={sim.snapshot}
                      namespaces={userNamespaces}
                      onSelect={setSelected}
                    />
                  </ErrorBoundary>
                </PanelBody>
              </Panel>
            </ResizablePane>

            <ResizableHandle orientation="horizontal" aria-label="Resize topology" />

            <ResizablePane id="right-tabs" minSize="30%" className="h-full">
              <Panel className="h-full">
                <div className="border-border flex h-10 shrink-0 items-center gap-1 border-b px-1.5">
                  {RIGHT_TABS.map((tab) => (
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
                  ) : rightTab === "network" ? (
                    sim.ready ? (
                      <NetworkActivity simulator={sim.simulator} />
                    ) : (
                      <p className="text-subtle p-4 text-xs">Cluster is still booting…</p>
                    )
                  ) : rightTab === "events" ? (
                    <EventsTimeline events={sim.snapshot.events} namespace={NAMESPACE} />
                  ) : (
                    <ResourceSummary snapshot={sim.snapshot} />
                  )}
                </div>
              </Panel>
            </ResizablePane>
          </ResizableGroup>
        </ResizablePane>
      </ResizableGroup>

      <SaveLabDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title={lab ? "Save a copy" : "Save as lab"}
        suggestedName={lab ? `${lab.name} copy` : `my ${template.title.toLowerCase()} lab`}
        onSave={handleCreateLab}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  // "Simulator ready" (not bare "Ready") so it can't be misread as workload health.
  const label =
    status === "ready"
      ? "Simulator ready"
      : status === "paused"
        ? "Simulator paused"
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
