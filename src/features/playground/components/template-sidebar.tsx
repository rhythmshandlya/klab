"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import {
  deleteSandbox,
  loadSandboxes,
  saveSandbox,
  type SavedSandbox,
} from "@/lib/storage/local-sandboxes";
import { cn } from "@/lib/utils/cn";

import { usePlaygroundStore } from "../playground-store";

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

const CHEATSHEET: { cmd: string; desc: string }[] = [
  { cmd: "kubectl get all", desc: "List common resources" },
  { cmd: "kubectl describe pod <name>", desc: "Detailed info" },
  { cmd: "kubectl logs <pod>", desc: "View pod logs" },
  { cmd: "kubectl get events", desc: "Show events" },
  { cmd: "curl http://<svc>/", desc: "Probe a Service" },
];

export function TemplateSidebar({ currentTemplateId }: { currentTemplateId: string }) {
  const files = usePlaygroundStore((s) => s.files);
  const addFile = usePlaygroundStore((s) => s.addFile);
  const setFile = usePlaygroundStore((s) => s.setFile);
  const loadFiles = usePlaygroundStore((s) => s.loadFiles);

  const [sandboxes, setSandboxes] = useState<SavedSandbox[]>([]);
  const [name, setName] = useState("");
  // Load client-only localStorage after mount; a lazy useState initializer would
  // read localStorage during SSR-hydration and cause a mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSandboxes(loadSandboxes()), []);

  const insertSnippet = (kind: string) => {
    const path = `${kind.toLowerCase()}-${Object.keys(files).length + 1}.yaml`;
    addFile(path);
    setFile(path, SNIPPETS[kind] ?? "");
  };

  const save = () => {
    const trimmed = name.trim() || `sandbox-${sandboxes.length + 1}`;
    setSandboxes(
      saveSandbox({ name: trimmed, templateId: currentTemplateId, files, savedAt: Date.now() }),
    );
    setName("");
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
        <div className="flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name…"
            className="border-border bg-code text-foreground focus-visible:ring-ring h-7 min-w-0 flex-1 rounded border px-2 text-xs outline-none focus-visible:ring-2"
          />
          <button
            type="button"
            onClick={save}
            className="border-border bg-panel-elevated text-muted hover:text-foreground h-7 rounded border px-2 text-xs"
          >
            Save
          </button>
        </div>
        {sandboxes.length === 0 ? (
          <p className="text-subtle mt-2 text-xs">No saved sandboxes yet.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {sandboxes.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => loadFiles(s.files)}
                  className="text-muted hover:text-foreground truncate text-left text-xs"
                  title={`Load ${s.name}`}
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => setSandboxes(deleteSandbox(s.name))}
                  className="text-subtle hover:text-red"
                >
                  <icons.error className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
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

      <Section title="Command cheatsheet">
        <ul className="space-y-1.5">
          {CHEATSHEET.map((c) => (
            <li key={c.cmd}>
              <code className="text-blue block truncate font-mono text-[11px]">{c.cmd}</code>
              <span className="text-subtle text-[11px]">{c.desc}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
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
