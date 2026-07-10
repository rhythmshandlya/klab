"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import { PLAYGROUND_TEMPLATES, getTemplateById } from "@/content/playground-templates";
import type { SavedLab } from "@/lib/storage/local-labs";
import { cn } from "@/lib/utils/cn";

import { useLabsStore } from "../labs-store";
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

export function TemplateSidebar({
  currentTemplateId,
  currentLabId,
}: {
  currentTemplateId: string;
  currentLabId?: string;
}) {
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
      <Section title="My labs">
        <MyLabs currentLabId={currentLabId} />
      </Section>

      <Section title="Templates">
        <ul className="space-y-0.5">
          {PLAYGROUND_TEMPLATES.map((t) => {
            const Icon = icons.deployment;
            const active = currentLabId === undefined && t.id === currentTemplateId;
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

      <Section title="Reference">
        <CommandReference />
      </Section>
    </div>
  );
}

/**
 * The user's saved labs — first-class workspaces with their own routes. Saving
 * happens in the workspace toolbar ("Save as lab"); this list opens, renames,
 * and deletes them.
 */
function MyLabs({ currentLabId }: { currentLabId?: string }) {
  const router = useRouter();
  const labs = useLabsStore((s) => s.labs);
  const hydrated = useLabsStore((s) => s.hydrated);
  const hydrate = useLabsStore((s) => s.hydrate);
  const update = useLabsStore((s) => s.update);
  const remove = useLabsStore((s) => s.remove);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!useLabsStore.getState().hydrated) hydrate();
  }, [hydrate]);

  const commitRename = (lab: SavedLab) => {
    if (renameValue.trim()) update(lab.id, { name: renameValue });
    setRenamingId(null);
  };

  const handleDelete = (lab: SavedLab) => {
    if (pendingDelete !== lab.id) {
      setPendingDelete(lab.id);
      return;
    }
    setPendingDelete(null);
    remove(lab.id);
    // Deleting the lab you're standing in sends you back to its template.
    if (currentLabId === lab.id) {
      const fallback = getTemplateById(lab.templateId) ? lab.templateId : "";
      router.push(`/playground/${fallback}`);
    }
  };

  if (!hydrated || labs.length === 0) {
    return (
      <p className="text-subtle px-2 text-xs leading-relaxed">
        Start from a template, then use <span className="text-muted font-medium">Save as lab</span>{" "}
        in the toolbar to keep your work here.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {labs.map((lab) => {
        const active = lab.id === currentLabId;
        const template = getTemplateById(lab.templateId);
        const armed = pendingDelete === lab.id;
        return (
          <li key={lab.id} className="group relative">
            {renamingId === lab.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(lab)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(lab);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                aria-label={`Rename ${lab.name}`}
                className="border-border bg-code text-foreground focus-visible:ring-ring mx-2 my-1 h-7 w-[calc(100%-1rem)] rounded border px-2 text-xs outline-none focus-visible:ring-2"
              />
            ) : (
              <>
                <Link
                  href={`/playground/lab/${lab.id}`}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                    active
                      ? "bg-panel-hover text-foreground"
                      : "text-muted hover:bg-panel-hover hover:text-foreground",
                  )}
                >
                  <icons.bookmark
                    className={cn("mt-0.5 size-3.5 shrink-0", active ? "text-blue" : "text-subtle")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{lab.name}</span>
                    <span className="text-subtle block truncate text-[10px]">
                      {template?.title ?? lab.templateId} · {timeAgo(lab.updatedAt)}
                    </span>
                  </span>
                </Link>
                <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Rename ${lab.name}`}
                    onClick={() => {
                      setRenamingId(lab.id);
                      setRenameValue(lab.name);
                    }}
                    className="text-subtle hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <icons.edit className="size-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={armed ? `Confirm delete ${lab.name}` : `Delete ${lab.name}`}
                    onClick={() => handleDelete(lab)}
                    onBlur={() => setPendingDelete(null)}
                    className={cn(
                      "rounded p-1 transition-all",
                      armed
                        ? "text-red bg-red/10 opacity-100"
                        : "text-subtle hover:text-red opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    {armed ? (
                      <span className="px-0.5 text-[10px] font-semibold">Sure?</span>
                    ) : (
                      <icons.trash className="size-3" aria-hidden />
                    )}
                  </button>
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
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
