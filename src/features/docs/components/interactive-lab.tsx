"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { YamlEditor } from "@/components/editor/yaml-editor";
import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deploymentReadyReplicas,
  isPodReady,
  podPhase,
  readyEndpointCount,
} from "@/lib/kube/kubectl/format";
import { runCommandLine } from "@/lib/kube/command-runner";
import type { InteractiveLab as Lab } from "@/lib/domain/types";
import { setPlaygroundHandoff } from "@/lib/storage/playground-handoff";
import {
  XtermTerminal,
  type TerminalRunResult,
} from "@/components/terminal/xterm-terminal";
import { cn } from "@/lib/utils/cn";

import { useSimulator } from "@/features/problems/hooks/use-simulator";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-40" /> },
);

const NAMESPACE = "default";

/**
 * Inline lab entry: a compact card in the reading flow. Starting the lab opens a
 * full workspace in a modal overlay (Radix Dialog) instead of expanding a cramped
 * box inline — reading stays clean, and the lab gets real editor + terminal room.
 */
export function InteractiveLab({ lab }: { lab: Lab }) {
  const [open, setOpen] = useState(false);
  const Flask = icons.docsInteractive;

  return (
    <>
      <div id={`lab-${lab.id}`} className="border-border bg-panel rounded-md border p-5">
        <div className="text-purple flex items-center gap-2">
          <Flask className="size-4" aria-hidden />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
            Interactive lab
          </span>
        </div>
        <h4 className="text-foreground mt-2 text-base font-semibold">{lab.title}</h4>
        <p className="text-muted mt-1 text-sm leading-relaxed">{lab.prompt}</p>
        {lab.tasks?.length ? (
          <ul className="mt-4 grid gap-2">
            {lab.tasks.map((task) => (
              <li key={task} className="text-muted flex gap-2 text-sm">
                <icons.success className="text-green mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{task}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Button variant="primary" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          <Flask aria-hidden />
          Start lab
        </Button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content
            aria-label={`Lab: ${lab.title}`}
            className="anim-content border-border-strong bg-panel fixed top-1/2 left-1/2 z-50 flex h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
          >
            <Dialog.Title asChild>
              <VisuallyHidden>{lab.title}</VisuallyHidden>
            </Dialog.Title>
            {open ? <LiveLab lab={lab} /> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function LiveLab({ lab }: { lab: Lab }) {
  const router = useRouter();
  const sim = useSimulator(lab);
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(lab.files.map((f) => [f.path, f.initialValue])),
  );
  const [activePath, setActivePath] = useState(lab.files[0]?.path ?? "");
  const [applying, setApplying] = useState(false);

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      await sim.applyFiles(files);
    } finally {
      setApplying(false);
    }
  }, [sim, files]);

  const reset = useCallback(async () => {
    await sim.reset();
    setFiles(Object.fromEntries(lab.files.map((f) => [f.path, f.initialValue])));
  }, [sim, lab.files]);

  const openInPlayground = useCallback(() => {
    setPlaygroundHandoff(files);
    router.push("/playground");
  }, [files, router]);

  const runCommand = useCallback(
    async (line: string): Promise<TerminalRunResult> => {
      if (!sim.ready)
        return { output: "Cluster is still booting — try again in a moment.", isError: true };
      const result = await runCommandLine(line, {
        simulator: sim.simulator,
        namespace: NAMESPACE,
        files,
      });
      return { output: result.output, isError: result.isError, clear: result.clear };
    },
    [sim.ready, sim.simulator, files],
  );

  const pods = useMemo(
    () => sim.snapshot.pods.filter((p) => (p.metadata?.namespace ?? "default") === NAMESPACE),
    [sim.snapshot.pods],
  );
  const service = sim.snapshot.services.find(
    (s) => (s.metadata?.namespace ?? "default") === NAMESPACE,
  );
  const deployment = sim.snapshot.deployments.find(
    (d) => (d.metadata?.namespace ?? "default") === NAMESPACE,
  );
  const endpoints = service ? readyEndpointCount(service, sim.snapshot.endpointSlices) : null;
  const paths = Object.keys(files);
  const readyPods = pods.filter(isPodReady).length;
  const desiredReplicas = deployment?.spec?.replicas ?? pods.length;
  const availableReplicas = deployment ? deploymentReadyReplicas(deployment) : readyPods;
  const updatedReplicas = deployment?.status?.updatedReplicas ?? readyPods;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-purple flex items-center gap-2">
            <icons.docsInteractive className="size-4" aria-hidden />
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Lab</span>
          </div>
          <p className="text-foreground mt-0.5 truncate text-sm font-semibold">{lab.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={sim.status} />
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close lab"
              className="text-subtle hover:text-foreground hover:bg-panel-hover rounded-md p-1.5 transition-colors"
            >
              <icons.close className="size-4" aria-hidden />
            </button>
          </Dialog.Close>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Left: editor + terminal */}
        <div className="bg-panel flex min-h-0 flex-col border-r border-border">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-border flex h-9 shrink-0 items-center gap-1 border-b px-2">
              <span className="text-subtle mr-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Desired state
              </span>
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
            <div className="min-h-[16rem] flex-1">
              {activePath ? (
                <YamlEditor
                  path={`lab/${lab.id}/${activePath}`}
                  value={files[activePath] ?? ""}
                  onChange={(value) => setFiles((f) => ({ ...f, [activePath]: value }))}
                />
              ) : null}
            </div>
          </div>

          <div className="flex min-h-[12rem] flex-col border-t border-border">
            <div className="border-border flex h-9 shrink-0 items-center justify-between border-b px-3">
              <span className="text-subtle flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
                <icons.terminal className="text-green size-3.5" aria-hidden />
                Terminal
              </span>
              <span className="text-subtle text-[11px]">kubectl · curl · dig</span>
            </div>
            <div className="bg-terminal min-h-0 flex-1">
              <ErrorBoundary label="Terminal">
                <XtermTerminal
                  onCommand={runCommand}
                  welcome={["klab lab terminal — type a command and press Enter.", "Try: kubectl get pods"]}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* Right: live cluster state */}
        <div className="bg-panel-elevated flex min-h-0 flex-col overflow-y-auto">
          <div className="border-border grid grid-cols-2 gap-2 border-b p-3 lg:grid-cols-2">
            <Metric label="Desired" value={desiredReplicas} />
            <Metric
              label="Available"
              value={availableReplicas}
              tone={availableReplicas > 0 ? "green" : "amber"}
            />
            <Metric label="Updated" value={updatedReplicas} tone="purple" />
            <Metric label="Ready Pods" value={readyPods} tone={readyPods > 0 ? "green" : "amber"} />
          </div>

          <div className="border-border border-b p-3">
            <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Topology
            </p>
            <div className="h-48">
              <ErrorBoundary label="Topology">
                <ServiceTopology snapshot={sim.snapshot} namespace={NAMESPACE} />
              </ErrorBoundary>
            </div>
          </div>

          <div className="flex-1 space-y-2 p-3">
            <p className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
              Pods
            </p>
            {endpoints !== null ? (
              <p className={cn("text-sm font-medium", endpoints > 0 ? "text-green" : "text-red")}>
                {service?.metadata?.name}: {endpoints} ready endpoint
                {endpoints === 1 ? "" : "s"}
              </p>
            ) : null}
            {pods.length === 0 ? (
              <p className="text-subtle text-xs">
                No pods yet. Edit the YAML, then apply changes.
              </p>
            ) : (
              pods.map((p) => (
                <div
                  key={p.metadata?.name}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted truncate font-mono text-xs">
                    {p.metadata?.name}
                  </span>
                  <Badge tone={isPodReady(p) ? "success" : "warning"}>
                    {isPodReady(p) ? "Ready" : podPhase(p)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-border flex flex-wrap items-center gap-2 border-t p-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void apply()}
          disabled={applying || !sim.ready}
        >
          <icons.run aria-hidden />
          {applying ? "Applying..." : "Apply changes"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={!sim.ready}>
          <icons.reset aria-hidden />
          Reset
        </Button>
        <Button variant="secondary" size="sm" onClick={openInPlayground}>
          <icons.playground aria-hidden />
          Open in Playground
        </Button>
        {lab.tryChanging ? (
          <p className="text-subtle ml-auto flex items-center gap-1.5 text-xs">
            <icons.config className="text-amber size-3.5" aria-hidden />
            {lab.tryChanging}
          </p>
        ) : null}
      </div>

      {/* Debrief */}
      {lab.debrief ? (
        <div className="border-border bg-code/50 max-h-44 overflow-y-auto border-t px-4 py-3">
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <icons.chevronDown className="text-subtle size-4" aria-hidden />
            What just happened?
          </p>
          <p className="text-muted mt-2 text-sm leading-relaxed">{lab.debrief}</p>
          {lab.commands?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {lab.commands.map((command) => (
                <code
                  key={command}
                  className="border-border bg-terminal text-muted rounded border px-2 py-1 font-mono text-xs"
                >
                  {command}
                </code>
              ))}
            </div>
          ) : null}
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
  tone?: "blue" | "green" | "amber" | "purple";
}) {
  const toneClass = {
    blue: "text-blue border-blue/25 bg-blue/5",
    green: "text-green border-green/25 bg-green/5",
    amber: "text-amber border-amber/25 bg-amber/5",
    purple: "text-purple border-purple/25 bg-purple/5",
  }[tone];
  return (
    <div className={cn("rounded-md border px-3 py-2", toneClass)}>
      <p className="tabnums text-lg leading-none font-semibold">{value}</p>
      <p className="text-muted mt-1 truncate text-[11px]">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "ready"
      ? "Simulator ready"
      : status === "error"
        ? "Simulator error"
        : "Simulator booting...";
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
