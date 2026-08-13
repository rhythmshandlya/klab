"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
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
import type { SavedPlayground } from "@/lib/labs/contracts";
import { takePlaygroundHandoff } from "@/lib/storage/playground-handoff";
import { cn } from "@/lib/utils/cn";

import type { SelectedObject } from "@/features/problems/level-store";
import { useSimulator, type SimulatorBootSpec } from "@/features/problems/hooks/use-simulator";

import { usePlaygroundsStore } from "../labs-store";
import { usePlaygroundStore } from "../playground-store";
import { MultiFileEditor } from "./multi-file-editor";
import { NetworkActivity } from "./network-activity";
import { PublishPlaygroundDialog } from "./publish-playground-dialog";
import { ResourceSummary } from "./resource-summary";
import { TemplateSidebar } from "./template-sidebar";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((module) => module.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-[calc(100%-1.5rem)]" /> },
);

const NAMESPACE = "default";
const AUTOSAVE_DELAY_MS = 850;
type RightTab = "explorer" | "network" | "events" | "resources";
type SaveState = "idle" | "saving" | "saved" | "error";
const RIGHT_TABS = ["explorer", "network", "events", "resources"] as const;

export function PlaygroundWorkspace({
  template,
  playground,
}: {
  template: PlaygroundTemplate;
  playground?: SavedPlayground;
}) {
  const router = useRouter();
  const initTemplate = usePlaygroundStore((state) => state.initTemplate);
  const loadFiles = usePlaygroundStore((state) => state.loadFiles);
  const contentRevision = usePlaygroundStore((state) => state.contentRevision);
  const activeFilePath = usePlaygroundStore((state) => state.activeFilePath);
  const hydrated = usePlaygroundsStore((state) => state.hydrated);
  const createPlayground = usePlaygroundsStore((state) => state.create);
  const updatePlayground = usePlaygroundsStore((state) => state.update);
  const duplicatePlayground = usePlaygroundsStore((state) => state.duplicate);
  const publishPlayground = usePlaygroundsStore((state) => state.publish);
  const unpublishPlayground = usePlaygroundsStore((state) => state.unpublish);
  const identity = usePlaygroundsStore((state) => state.identity);

  const initializedKey = useRef<string | null>(null);
  useEffect(() => {
    const key = playground?.id ?? `template:${template.id}`;
    if (initializedKey.current === key) return;
    initializedKey.current = key;
    initTemplate(template);
    if (playground) {
      loadFiles(playground.files, playground.activeFilePath);
      return;
    }
    const handoff = takePlaygroundHandoff();
    if (handoff && Object.keys(handoff).length > 0) loadFiles(handoff);
  }, [template, playground, initTemplate, loadFiles]);

  const [simulatorBootSpec] = useState<SimulatorBootSpec>(() =>
    playground
      ? {
          ...template,
          initialManifests: [],
          files: Object.entries(playground.files).map(([path, initialValue]) => ({
            path,
            initialValue,
            applyAtBoot: true,
          })),
        }
      : template,
  );
  const sim = useSimulator(simulatorBootSpec);
  const columnsLayout = usePersistedLayout("klab:layout:playground-workspace:columns:v2");
  const centerLayout = usePersistedLayout("klab:layout:playground-workspace:center");
  const inspectorLayout = usePersistedLayout("klab:layout:playground-workspace:inspector:v2");
  const [rightTab, setRightTab] = useState<RightTab>("explorer");
  const [selected, setSelected] = useState<SelectedObject | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(playground ? "saved" : "idle");
  const [title, setTitle] = useState(playground?.name ?? "Untitled Playground");
  const [publishOpen, setPublishOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const creationPromise = useRef<Promise<SavedPlayground> | null>(null);
  const saveVersion = useRef(0);
  const lastSavedRevision = useRef(0);
  const lastSavedActiveFile = useRef(playground?.activeFilePath ?? activeFilePath);

  const createAndNavigate = useCallback(
    async (name = title) => {
      if (playground) return playground;
      if (creationPromise.current) return creationPromise.current;
      const state = usePlaygroundStore.getState();
      setSaveState("saving");
      const pending = createPlayground({
        name,
        templateId: template.id,
        files: state.files,
        activeFilePath: state.activeFilePath,
      });
      creationPromise.current = pending;
      try {
        const created = await pending;
        const latest = usePlaygroundStore.getState();
        if (latest.contentRevision !== state.contentRevision) {
          await updatePlayground(created.id, {
            files: latest.files,
            activeFilePath: latest.activeFilePath,
          });
        }
        setSaveState("saved");
        router.replace(`/playground/p/${created.id}`);
        return created;
      } catch (error) {
        setSaveState("error");
        creationPromise.current = null;
        throw error;
      }
    },
    [createPlayground, playground, router, template.id, title, updatePlayground],
  );

  // A template becomes an autosaved Playground on the user's first manifest edit.
  useEffect(() => {
    if (playground || !hydrated || contentRevision === 0) return;
    const timeout = window.setTimeout(() => {
      if (usePlaygroundStore.getState().contentRevision === 0) return;
      void createAndNavigate().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [contentRevision, createAndNavigate, hydrated, playground]);

  // Persist manifest and active-tab changes without a manual Save action.
  useEffect(() => {
    if (!playground || !hydrated) return;
    const contentChanged = contentRevision !== lastSavedRevision.current;
    const activeChanged = activeFilePath !== lastSavedActiveFile.current;
    if (!contentChanged && !activeChanged) return;

    const version = ++saveVersion.current;
    const timeout = window.setTimeout(() => {
      setSaveState("saving");
      const state = usePlaygroundStore.getState();
      void updatePlayground(playground.id, {
        files: state.files,
        activeFilePath: state.activeFilePath,
      })
        .then(() => {
          lastSavedRevision.current = state.contentRevision;
          lastSavedActiveFile.current = state.activeFilePath;
          if (saveVersion.current === version) setSaveState("saved");
        })
        .catch(() => {
          if (saveVersion.current === version) setSaveState("error");
        });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [activeFilePath, contentRevision, hydrated, playground, updatePlayground]);

  const userNamespaces = useMemo(() => {
    const names = sim.snapshot.namespaces
      .map((namespace) => namespace.metadata?.name ?? "")
      .filter((name) => name !== "" && !name.startsWith("kube-"));
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
      if (!sim.ready) {
        return { output: "Cluster is still booting: try again in a moment.", isError: true };
      }
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
    setApplyMessage(null);
    try {
      const result = await sim.applyFiles(usePlaygroundStore.getState().files);
      setApplyMessage(result.ok ? "Manifests applied" : result.error);
    } finally {
      setApplying(false);
    }
  }, [sim]);

  const handleReset = useCallback(async () => {
    await sim.reset();
    if (playground) {
      const current = usePlaygroundsStore
        .getState()
        .playgrounds.find((candidate) => candidate.id === playground.id);
      const files = current?.files ?? playground.files;
      usePlaygroundStore
        .getState()
        .loadFiles(files, current?.activeFilePath ?? playground.activeFilePath);
      await sim.applyFiles(files);
    } else {
      usePlaygroundStore.getState().resetToTemplate();
    }
    setSelected(null);
    setPaused(false);
    setApplyMessage(null);
  }, [sim, playground]);

  const commitTitle = useCallback(async () => {
    const next = title.trim() || "Untitled Playground";
    setTitle(next);
    setSaveState("saving");
    try {
      if (playground) await updatePlayground(playground.id, { name: next });
      else if (hydrated) await createAndNavigate(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [createAndNavigate, hydrated, playground, title, updatePlayground]);

  const handleDuplicate = useCallback(async () => {
    if (!playground) return;
    const state = usePlaygroundStore.getState();
    setSaveState("saving");
    try {
      await updatePlayground(playground.id, {
        files: state.files,
        activeFilePath: state.activeFilePath,
      });
      const duplicate = await duplicatePlayground(playground.id);
      setSaveState("saved");
      if (duplicate) router.push(`/playground/p/${duplicate.id}`);
    } catch {
      setSaveState("error");
    }
  }, [duplicatePlayground, playground, router, updatePlayground]);

  const handleExport = useCallback(() => {
    const files = usePlaygroundStore.getState().files;
    const yaml = Object.entries(files)
      .map(([path, contents]) => `# ${path}\n${contents}`)
      .join("\n---\n");
    const url = URL.createObjectURL(new Blob([yaml], { type: "application/yaml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "playground"
    }.yaml`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [title]);

  const openPublish = useCallback(() => {
    if (!identity) {
      setSignInOpen(true);
      return;
    }
    setPublishOpen(true);
  }, [identity]);

  const handlePublish = useCallback(
    async (description: string) => {
      if (!playground) return;
      const state = usePlaygroundStore.getState();
      await updatePlayground(playground.id, {
        files: state.files,
        activeFilePath: state.activeFilePath,
      });
      await publishPlayground(playground.id, description);
    },
    [playground, publishPlayground, updatePlayground],
  );

  const handleUnpublish = useCallback(async () => {
    if (!playground) return;
    await unpublishPlayground(playground.id);
  }, [playground, unpublishPlayground]);

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-x-auto p-3">
      <ResizableGroup
        orientation="horizontal"
        id="playground-columns"
        defaultLayout={columnsLayout.defaultLayout}
        onLayoutChanged={columnsLayout.onLayoutChanged}
        className="h-full min-w-[1080px]"
      >
        <ResizablePane
          id="rail-left"
          defaultSize="19%"
          minSize="220px"
          maxSize="36%"
          className="h-full"
        >
          <Panel className="h-full">
            <PanelHeader title="Playgrounds" icon={<icons.playground />} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TemplateSidebar currentPlaygroundId={playground?.id} />
            </div>
          </Panel>
        </ResizablePane>

        <ResizableHandle orientation="vertical" aria-label="Resize playground sidebar" />

        <ResizablePane id="center" minSize="32%" className="h-full">
          <ResizableGroup
            orientation="vertical"
            id="playground-center"
            defaultLayout={centerLayout.defaultLayout}
            onLayoutChanged={centerLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane id="center-editor" defaultSize="60%" minSize="20%" className="h-full">
              <Panel className="@container h-full">
                <div
                  className="border-border flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
                  data-testid="playground-editor-header"
                >
                  <div className="order-1 flex w-full min-w-48 items-center gap-2 @4xl:w-auto @4xl:min-w-0 @4xl:flex-1">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      onBlur={() => void commitTitle()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setTitle(playground?.name ?? "Untitled Playground");
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label="Playground name"
                      className="text-foreground focus:bg-code focus:ring-ring w-0 max-w-64 min-w-0 flex-1 rounded px-1.5 py-1 text-sm font-semibold outline-none focus:ring-2"
                    />
                    <div className="ml-auto shrink-0 @4xl:ml-0">
                      <SaveIndicator state={saveState} transient={!playground} />
                    </div>
                    {applyMessage ? (
                      <span
                        className={cn(
                          "hidden max-w-40 truncate text-[11px] @3xl:inline",
                          applyMessage === "Manifests applied" ? "text-green" : "text-red",
                        )}
                        role="status"
                      >
                        {applyMessage}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="order-2 flex min-w-0 flex-wrap items-center gap-1.5 @4xl:ml-auto"
                    role="toolbar"
                    aria-label="Secondary playground actions"
                  >
                    {playground ? (
                      <ToolbarButton
                        onClick={openPublish}
                        disabled={identity === undefined}
                        label={playground.publishedCopyId ? "Manage publication" : "Publish"}
                      >
                        <icons.community aria-hidden />
                        <span className="hidden @4xl:inline">
                          {playground.publishedCopyId ? "Published" : "Publish"}
                        </span>
                      </ToolbarButton>
                    ) : null}
                    {playground ? (
                      <ToolbarButton onClick={() => void handleDuplicate()} label="Duplicate">
                        <icons.copy aria-hidden />
                        <span className="hidden @4xl:inline">Duplicate</span>
                      </ToolbarButton>
                    ) : null}
                    <ToolbarButton onClick={handleExport} label="Export YAML">
                      <icons.download aria-hidden />
                      <span className="hidden @4xl:inline">Export</span>
                    </ToolbarButton>
                    <ToolbarButton
                      onClick={togglePause}
                      disabled={!sim.ready}
                      label={paused ? "Resume" : "Pause"}
                    >
                      {paused ? <icons.run aria-hidden /> : <icons.pause aria-hidden />}
                      <span className="hidden @4xl:inline">{paused ? "Resume" : "Pause"}</span>
                    </ToolbarButton>
                    <ToolbarButton
                      onClick={() => void handleReset()}
                      disabled={!sim.ready}
                      label="Reset"
                    >
                      <icons.reset aria-hidden />
                      <span className="hidden @4xl:inline">Reset</span>
                    </ToolbarButton>
                  </div>
                  <div
                    className="order-3 ml-auto flex shrink-0 items-center gap-1.5 @4xl:ml-0"
                    role="toolbar"
                    aria-label="Primary playground actions"
                  >
                    {playground ? (
                      <ToolbarButton
                        onClick={() =>
                          void updatePlayground(playground.id, { starred: !playground.starred })
                        }
                        label={playground.starred ? "Unstar" : "Star"}
                      >
                        <icons.star
                          fill={playground.starred ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </ToolbarButton>
                    ) : null}
                    <ToolbarButton
                      onClick={() => void handleApply()}
                      disabled={applying || !sim.ready}
                      primary
                      label="Apply manifests"
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

        <ResizablePane
          id="rail-right"
          defaultSize="33%"
          minSize="320px"
          maxSize="42%"
          className="h-full"
        >
          <ResizableGroup
            orientation="vertical"
            id="playground-inspector"
            defaultLayout={inspectorLayout.defaultLayout}
            onLayoutChanged={inspectorLayout.onLayoutChanged}
            className="h-full"
          >
            <ResizablePane
              id="playground-topology"
              defaultSize="33vw"
              minSize="35%"
              className="h-full"
            >
              <Panel className="h-full">
                <PanelHeader title="Cluster Topology" icon={<icons.cluster />} />
                <PanelBody scroll={false} className="p-0" data-testid="playground-topology-body">
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

            <ResizablePane id="playground-inspector-tabs" minSize="15%" className="h-full">
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
      {playground ? (
        <PublishPlaygroundDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          playground={playground}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
        />
      ) : null}
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}

function SaveIndicator({ state, transient }: { state: SaveState; transient: boolean }) {
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Save failed"
          : transient
            ? "Autosaves when you edit"
            : "Saved";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-[11px]",
        state === "error" ? "text-red" : state === "saving" ? "text-amber" : "text-green",
      )}
      role="status"
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
      {state === "saved" ? <span aria-hidden>✓</span> : null}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
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
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
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
