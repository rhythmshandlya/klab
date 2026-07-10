"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import { PLAYGROUND_TEMPLATES, getTemplateById } from "@/content/playground-templates";
import {
  deleteSandbox,
  loadSandboxes,
  saveSandbox,
  type SavedSandbox,
} from "@/lib/storage/local-sandboxes";
import { setPlaygroundHandoff } from "@/lib/storage/playground-handoff";
import { cn } from "@/lib/utils/cn";

import { usePlaygroundStore } from "../playground-store";
import { CommandReference } from "./command-reference";

const SNIPPETS: Record<string, string> = {
  Pod: `apiVersion: v1
kind: Pod
metadata: { name: my-pod, labels: { app: my-app } }
spec:
  containers:
    - name: app
      image: klab/web-app:1.0.0
      ports: [{ containerPort: 8080 }]
`,
  Service: `apiVersion: v1
kind: Service
metadata: { name: my-svc }
spec:
  selector: { app: my-app }
  ports: [{ port: 80, targetPort: 8080 }]
`,
  Deployment: `apiVersion: apps/v1
kind: Deployment
metadata: { name: my-app, labels: { app: my-app } }
spec:
  replicas: 2
  selector: { matchLabels: { app: my-app } }
  template:
    metadata: { labels: { app: my-app } }
    spec:
      containers:
        - name: app
          image: klab/web-app:1.0.0
          ports: [{ containerPort: 8080 }]
`,
};

export function TemplateSidebar({ currentTemplateId }: { currentTemplateId: string }) {
  const files = usePlaygroundStore((s) => s.files);
  const addFile = usePlaygroundStore((s) => s.addFile);
  const setFile = usePlaygroundStore((s) => s.setFile);

  const insertSnippet = (kind: string) => {
    const path = `${kind.toLowerCase()}-${Object.keys(files).length + 1}.yaml`;
    addFile(path);
    setFile(path, SNIPPETS[kind] ?? "");
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3 text-sm">
      <Section title="Templates">
        <ul className="space-y-0.5">
          {PLAYGROUND_TEMPLATES.map((t) => {
            const Icon = icons.deployment;
            const active = t.id === currentTemplateId;
            return (
              <li key={t.id}>
                <Link
                  href={`/playground/${t.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    active
                      ? "bg-panel-hover text-foreground"
                      : "text-muted hover:bg-panel-hover hover:text-foreground",
                  )}
                >
                  <Icon className="text-subtle size-3.5" aria-hidden />
                  {t.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Saved sandboxes">
        <SavedSandboxes currentTemplateId={currentTemplateId} />
      </Section>

      <Section title="Object shortcuts">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(SNIPPETS).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => insertSnippet(kind)}
              className="border-border bg-panel-elevated text-muted hover:border-border-strong hover:text-foreground rounded border px-2 py-1 text-xs"
            >
              + {kind}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Commands">
        <CommandReference />
      </Section>
    </div>
  );
}

/**
 * Named snapshots of the editor's files. Saving prompts before overwriting an
 * existing name; loading restores the files — and when the sandbox was saved on a
 * different template, hands the files off and navigates so the underlying cluster
 * template matches. Deleting asks for a second confirming click.
 */
function SavedSandboxes({ currentTemplateId }: { currentTemplateId: string }) {
  const router = useRouter();
  const files = usePlaygroundStore((s) => s.files);
  const loadFiles = usePlaygroundStore((s) => s.loadFiles);

  const [sandboxes, setSandboxes] = useState<SavedSandbox[]>([]);
  const [name, setName] = useState("");
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  // Load client-only localStorage after mount; a lazy useState initializer would
  // read localStorage during SSR-hydration and cause a mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSandboxes(loadSandboxes()), []);

  const effectiveName = () => name.trim() || nextDefaultName(sandboxes);

  const save = () => {
    const trimmed = effectiveName();
    const exists = sandboxes.some((s) => s.name === trimmed);
    if (exists && pendingOverwrite !== trimmed) {
      // First click on a colliding name arms the overwrite confirmation.
      setPendingOverwrite(trimmed);
      return;
    }
    setPendingOverwrite(null);
    setSandboxes(
      saveSandbox({ name: trimmed, templateId: currentTemplateId, files, savedAt: Date.now() }),
    );
    setLoadedName(trimmed);
    setName("");
  };

  const load = (sandbox: SavedSandbox) => {
    if (sandbox.templateId !== currentTemplateId && getTemplateById(sandbox.templateId)) {
      // Boot the matching template; the workspace consumes the handoff on mount.
      setPlaygroundHandoff(sandbox.files);
      router.push(`/playground/${sandbox.templateId}`);
      return;
    }
    loadFiles(sandbox.files);
    setLoadedName(sandbox.name);
  };

  const remove = (sandboxName: string) => {
    if (pendingDelete !== sandboxName) {
      setPendingDelete(sandboxName);
      return;
    }
    setPendingDelete(null);
    setSandboxes(deleteSandbox(sandboxName));
    if (loadedName === sandboxName) setLoadedName(null);
  };

  const saveLabel = pendingOverwrite ? "Overwrite?" : "Save";

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setPendingOverwrite(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={nextDefaultName(sandboxes)}
          aria-label="Sandbox name"
          className="border-border bg-code text-foreground focus-visible:ring-ring h-7 min-w-0 flex-1 rounded border px-2 text-xs outline-none focus-visible:ring-2"
        />
        <button
          type="button"
          onClick={save}
          className={cn(
            "h-7 rounded border px-2 text-xs transition-colors",
            pendingOverwrite
              ? "border-amber/50 bg-amber/10 text-amber"
              : "border-border bg-panel-elevated text-muted hover:text-foreground",
          )}
        >
          {saveLabel}
        </button>
      </div>
      {pendingOverwrite ? (
        <p className="text-amber mt-1.5 text-[11px]">
          &quot;{pendingOverwrite}&quot; exists — click again to replace it.
        </p>
      ) : null}

      {sandboxes.length === 0 ? (
        <p className="text-subtle mt-2 text-xs">
          Nothing saved yet. Name the current files and press Save to keep a snapshot you can reload
          any time.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {sandboxes.map((s) => {
            const template = getTemplateById(s.templateId);
            const isLoaded = loadedName === s.name;
            const isArmed = pendingDelete === s.name;
            return (
              <li
                key={s.name}
                className={cn(
                  "group border-border rounded-md border px-2 py-1.5 transition-colors",
                  isLoaded ? "border-blue/40 bg-blue/5" : "hover:bg-panel-hover",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => load(s)}
                    title={
                      s.templateId !== currentTemplateId
                        ? `Opens the ${template?.title ?? s.templateId} template`
                        : "Load into the editor"
                    }
                    className="text-foreground min-w-0 flex-1 truncate text-left text-xs font-medium"
                  >
                    {s.name}
                    {isLoaded ? <span className="text-blue ml-1.5 text-[10px]">loaded</span> : null}
                  </button>
                  <button
                    type="button"
                    aria-label={isArmed ? `Confirm delete ${s.name}` : `Delete ${s.name}`}
                    onClick={() => remove(s.name)}
                    onBlur={() => setPendingDelete(null)}
                    className={cn(
                      "shrink-0 rounded p-0.5 transition-colors",
                      isArmed
                        ? "text-red bg-red/10"
                        : "text-subtle hover:text-red opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    {isArmed ? (
                      <span className="px-1 text-[10px] font-semibold">Sure?</span>
                    ) : (
                      <icons.trash className="size-3.5" aria-hidden />
                    )}
                  </button>
                </div>
                <p className="text-subtle mt-0.5 flex items-center gap-1 text-[10px]">
                  <span className="truncate">{template?.title ?? s.templateId}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{timeAgo(s.savedAt)}</span>
                  <span className="shrink-0">
                    · {Object.keys(s.files).length} file
                    {Object.keys(s.files).length === 1 ? "" : "s"}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function nextDefaultName(sandboxes: SavedSandbox[]): string {
  const taken = new Set(sandboxes.map((s) => s.name));
  let n = sandboxes.length + 1;
  while (taken.has(`sandbox-${n}`)) n += 1;
  return `sandbox-${n}`;
}

function timeAgo(savedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-subtle mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}
