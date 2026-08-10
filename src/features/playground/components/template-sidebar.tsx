"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { icons } from "@/components/icons";
import { PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import type { PlaygroundTemplate } from "@/lib/domain/types";
import type { SavedPlayground } from "@/lib/labs/contracts";
import { cn } from "@/lib/utils/cn";

import { usePlaygroundsStore } from "../labs-store";
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

function templateFiles(template: PlaygroundTemplate): Record<string, string> {
  return Object.fromEntries(template.files.map((file) => [file.path, file.initialValue]));
}

export function TemplateSidebar({ currentPlaygroundId }: { currentPlaygroundId?: string }) {
  const router = useRouter();
  const files = usePlaygroundStore((state) => state.files);
  const addFile = usePlaygroundStore((state) => state.addFile);
  const setFile = usePlaygroundStore((state) => state.setFile);
  const playgrounds = usePlaygroundsStore((state) => state.playgrounds);
  const hydrated = usePlaygroundsStore((state) => state.hydrated);
  const create = usePlaygroundsStore((state) => state.create);
  const update = usePlaygroundsStore((state) => state.update);
  const duplicate = usePlaygroundsStore((state) => state.duplicate);
  const remove = usePlaygroundsStore((state) => state.remove);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const recent = playgrounds.slice(0, 5);
  const starred = playgrounds.filter((playground) => playground.starred);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? playgrounds.filter((playground) => playground.name.toLowerCase().includes(normalized))
      : [];
  }, [playgrounds, query]);

  const insertSnippet = (kind: string) => {
    const path = `${kind.toLowerCase()}-${Object.keys(files).length + 1}.yaml`;
    addFile(path);
    setFile(path, SNIPPETS[kind] ?? "");
  };

  const startFrom = async (template: PlaygroundTemplate) => {
    if (!hydrated || creating) return;
    setCreating(true);
    try {
      const created = await create({
        templateId: template.id,
        files: templateFiles(template),
        activeFilePath: template.files[0]?.path,
      });
      router.push(`/playground/p/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (playground: SavedPlayground) => {
    if (currentPlaygroundId === playground.id) {
      const state = usePlaygroundStore.getState();
      await update(playground.id, {
        files: state.files,
        activeFilePath: state.activeFilePath,
      });
    }
    const created = await duplicate(playground.id);
    if (created) router.push(`/playground/p/${created.id}`);
  };

  const handleDelete = async (playground: SavedPlayground) => {
    if (pendingDelete !== playground.id) {
      setPendingDelete(playground.id);
      return;
    }
    setPendingDelete(null);
    await remove(playground.id);
    if (currentPlaygroundId === playground.id) router.push("/playground");
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3 text-sm">
      <button
        type="button"
        onClick={() => void startFrom(PLAYGROUND_TEMPLATES[0]!)}
        disabled={!hydrated || creating}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        <icons.plus className="size-4" aria-hidden />
        {creating ? "Creating…" : "New Playground"}
      </button>

      <div>
        <label htmlFor="playground-search" className="sr-only">
          Search playgrounds
        </label>
        <div className="relative">
          <icons.search className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            id="playground-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playgrounds"
            className="border-border bg-code text-foreground placeholder:text-subtle focus-visible:ring-ring h-8 w-full rounded-md border pr-2 pl-8 text-xs outline-none focus-visible:ring-2"
          />
        </div>
      </div>

      {query.trim() ? (
        <Section title="Search results">
          <PlaygroundList
            playgrounds={results}
            currentPlaygroundId={currentPlaygroundId}
            pendingDelete={pendingDelete}
            onStar={(playground) => void update(playground.id, { starred: !playground.starred })}
            onDuplicate={(playground) => void handleDuplicate(playground)}
            onDelete={(playground) => void handleDelete(playground)}
          />
        </Section>
      ) : (
        <>
          <Section title="Recent">
            <PlaygroundList
              playgrounds={recent}
              currentPlaygroundId={currentPlaygroundId}
              pendingDelete={pendingDelete}
              onStar={(playground) => void update(playground.id, { starred: !playground.starred })}
              onDuplicate={(playground) => void handleDuplicate(playground)}
              onDelete={(playground) => void handleDelete(playground)}
            />
            {playgrounds.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="text-blue hover:text-blue/80 mt-2 flex items-center gap-1 px-2 text-xs font-medium"
              >
                {showAll ? "Hide all playgrounds" : "View all playgrounds"}
                <icons.arrowRight className="size-3" aria-hidden />
              </button>
            ) : null}
          </Section>

          {starred.length ? (
            <Section title="Starred">
              <PlaygroundList
                playgrounds={starred}
                currentPlaygroundId={currentPlaygroundId}
                pendingDelete={pendingDelete}
                onStar={(playground) =>
                  void update(playground.id, { starred: !playground.starred })
                }
                onDuplicate={(playground) => void handleDuplicate(playground)}
                onDelete={(playground) => void handleDelete(playground)}
              />
            </Section>
          ) : null}

          {showAll ? (
            <Section title="All Playgrounds">
              <PlaygroundList
                playgrounds={playgrounds}
                currentPlaygroundId={currentPlaygroundId}
                pendingDelete={pendingDelete}
                onStar={(playground) =>
                  void update(playground.id, { starred: !playground.starred })
                }
                onDuplicate={(playground) => void handleDuplicate(playground)}
                onDelete={(playground) => void handleDelete(playground)}
              />
            </Section>
          ) : null}
        </>
      )}

      <Section title="Templates">
        <ul className="space-y-0.5">
          {PLAYGROUND_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => void startFrom(template)}
                disabled={!hydrated || creating}
                className="text-muted hover:bg-panel-hover hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors disabled:opacity-50"
              >
                <icons.deployment className="text-subtle size-3.5" aria-hidden />
                {template.title}
              </button>
            </li>
          ))}
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

function PlaygroundList({
  playgrounds,
  currentPlaygroundId,
  pendingDelete,
  onStar,
  onDuplicate,
  onDelete,
}: {
  playgrounds: SavedPlayground[];
  currentPlaygroundId?: string;
  pendingDelete: string | null;
  onStar: (playground: SavedPlayground) => void;
  onDuplicate: (playground: SavedPlayground) => void;
  onDelete: (playground: SavedPlayground) => void;
}) {
  if (!playgrounds.length) {
    return <p className="text-subtle px-2 text-xs">No playgrounds yet.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {playgrounds.map((playground) => {
        const active = playground.id === currentPlaygroundId;
        const armed = pendingDelete === playground.id;
        return (
          <li key={playground.id} className="group relative">
            <Link
              href={`/playground/p/${playground.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md py-1.5 pr-20 pl-2 transition-colors",
                active
                  ? "bg-panel-hover text-foreground"
                  : "text-muted hover:bg-panel-hover hover:text-foreground",
              )}
            >
              <icons.yaml
                className={cn("size-3.5 shrink-0", active ? "text-blue" : "text-subtle")}
              />
              <span className="min-w-0 flex-1 truncate">{playground.name}</span>
              <span className="text-subtle shrink-0 text-[10px]">
                {timeAgo(playground.lastOpenedAt)}
              </span>
            </Link>
            <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <ActionButton
                label={`${playground.starred ? "Unstar" : "Star"} ${playground.name}`}
                onClick={() => onStar(playground)}
                active={playground.starred}
              >
                <icons.star
                  className="size-3"
                  fill={playground.starred ? "currentColor" : "none"}
                />
              </ActionButton>
              <ActionButton
                label={`Duplicate ${playground.name}`}
                onClick={() => onDuplicate(playground)}
              >
                <icons.copy className="size-3" />
              </ActionButton>
              <ActionButton
                label={armed ? `Confirm delete ${playground.name}` : `Delete ${playground.name}`}
                onClick={() => onDelete(playground)}
                destructive={armed}
              >
                {armed ? (
                  <span className="text-[9px] font-bold">Sure?</span>
                ) : (
                  <icons.trash className="size-3" />
                )}
              </ActionButton>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  active,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded p-1",
        active
          ? "text-amber"
          : destructive
            ? "bg-red/10 text-red"
            : "text-subtle hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
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
