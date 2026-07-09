"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/app-shell/error-boundary";
import { YamlEditor } from "@/components/editor/yaml-editor";
import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InteractiveLab as Lab } from "@/lib/domain/types";
import { isPodReady, podPhase, readyEndpointCount } from "@/lib/kube/kubectl/format";
import { setPlaygroundHandoff } from "@/lib/storage/playground-handoff";
import { cn } from "@/lib/utils/cn";

import { useSimulator } from "@/features/problems/hooks/use-simulator";

const ServiceTopology = dynamic(
  () => import("@/components/topology/service-topology").then((m) => m.ServiceTopology),
  { ssr: false, loading: () => <Skeleton className="m-3 h-40" /> },
);

const NAMESPACE = "default";

/** Lazily-started inline lab: renders a "Start lab" card until the learner opts in. */
export function InteractiveLab({ lab }: { lab: Lab }) {
  const [started, setStarted] = useState(false);
  const Flask = icons.docsInteractive;

  if (!started) {
    return (
      <div className="border-border bg-panel rounded-xl border p-5">
        <div className="text-purple flex items-center gap-2">
          <Flask className="size-4" aria-hidden />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
            Interactive lab
          </span>
        </div>
        <h4 className="text-foreground mt-2 text-base font-semibold">{lab.title}</h4>
        <p className="text-muted mt-1 text-sm">{lab.prompt}</p>
        <Button variant="primary" size="sm" className="mt-4" onClick={() => setStarted(true)}>
          <Flask aria-hidden />
          Start lab
        </Button>
      </div>
    );
  }
  return <LiveLab lab={lab} />;
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

  const pods = useMemo(
    () => sim.snapshot.pods.filter((p) => (p.metadata?.namespace ?? "default") === NAMESPACE),
    [sim.snapshot.pods],
  );
  const service = sim.snapshot.services.find(
    (s) => (s.metadata?.namespace ?? "default") === NAMESPACE,
  );
  const endpoints = service ? readyEndpointCount(service, sim.snapshot.endpointSlices) : null;
  const paths = Object.keys(files);

  return (
    <div className="border-border bg-panel overflow-hidden rounded-xl border">
      <div className="bg-border grid gap-px md:grid-cols-2">
        {/* Editor */}
        <div className="bg-panel flex min-h-0 flex-col">
          <div className="border-border flex h-9 items-center gap-1 border-b px-2">
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
          <div className="h-64">
            {activePath ? (
              <YamlEditor
                path={`lab/${lab.id}/${activePath}`}
                value={files[activePath] ?? ""}
                onChange={(value) => setFiles((f) => ({ ...f, [activePath]: value }))}
              />
            ) : null}
          </div>
        </div>

        {/* Live cluster */}
        <div className="bg-panel flex min-h-0 flex-col">
          <div className="border-border flex h-9 items-center justify-between border-b px-3">
            <span className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
              Live cluster
            </span>
            <StatusPill status={sim.status} />
          </div>
          <div className="border-border h-40 border-b">
            <ErrorBoundary label="Topology">
              <ServiceTopology snapshot={sim.snapshot} namespace={NAMESPACE} />
            </ErrorBoundary>
          </div>
          <div className="flex-1 space-y-1 overflow-auto p-3 text-xs">
            {endpoints !== null ? (
              <p className={cn("font-medium", endpoints > 0 ? "text-green" : "text-red")}>
                {service?.metadata?.name}: {endpoints} ready endpoint{endpoints === 1 ? "" : "s"}
              </p>
            ) : null}
            {pods.length === 0 ? (
              <p className="text-subtle">No pods yet — click Apply.</p>
            ) : (
              pods.map((p) => (
                <div key={p.metadata?.name} className="flex items-center justify-between gap-2">
                  <span className="text-muted truncate font-mono">{p.metadata?.name}</span>
                  <Badge tone={isPodReady(p) ? "success" : "warning"}>
                    {isPodReady(p) ? "Ready" : podPhase(p)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-border flex flex-wrap items-center gap-2 border-t p-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void apply()}
          disabled={applying || !sim.ready}
        >
          <icons.run aria-hidden />
          {applying ? "Applying…" : "Apply"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void reset()} disabled={!sim.ready}>
          <icons.reset aria-hidden />
          Reset
        </Button>
        <Button variant="ghost" size="sm" onClick={openInPlayground}>
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
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status === "ready" ? "Ready" : status === "error" ? "Error" : "Booting…";
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
