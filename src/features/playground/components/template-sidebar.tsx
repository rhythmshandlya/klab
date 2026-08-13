"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
  ConfigMap: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info
  API_URL: http://my-svc
`,
  Secret: `apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  API_TOKEN: replace-me
`,
  Namespace: `apiVersion: v1
kind: Namespace
metadata:
  name: team-app
`,
  StatefulSet: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web
  replicas: 2
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: klab/web-app:1.0.0
`,
  DaemonSet: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
spec:
  selector:
    matchLabels: { app: node-agent }
  template:
    metadata:
      labels: { app: node-agent }
    spec:
      containers:
        - name: agent
          image: klab/web-app:1.0.0
`,
  Job: `apiVersion: batch/v1
kind: Job
metadata:
  name: one-off-job
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: task
          image: busybox:1.36
          command: ["sh", "-c", "echo done"]
`,
  CronJob: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-job
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: task
              image: busybox:1.36
              command: ["sh", "-c", "date"]
`,
  Ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-svc
                port:
                  number: 80
`,
  NetworkPolicy: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
`,
  PersistentVolumeClaim: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
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
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set());
  const deleteTimers = useRef(new Map<string, number>());
  const [creating, setCreating] = useState(false);

  const visiblePlaygrounds = useMemo(
    () => playgrounds.filter((playground) => !pendingDeleteIds.has(playground.id)),
    [pendingDeleteIds, playgrounds],
  );
  const recent = visiblePlaygrounds.slice(0, 5);
  const starred = visiblePlaygrounds.filter((playground) => playground.starred);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? visiblePlaygrounds.filter((playground) =>
          playground.name.toLowerCase().includes(normalized),
        )
      : [];
  }, [query, visiblePlaygrounds]);

  const insertSnippet = (kind: string) => {
    const stem = kind.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    let suffix = Object.keys(files).length + 1;
    let path = `${stem}-${suffix}.yaml`;
    while (files[path] !== undefined) {
      suffix += 1;
      path = `${stem}-${suffix}.yaml`;
    }
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

  const handleDelete = (playground: SavedPlayground) => {
    if (pendingDeleteIds.has(playground.id)) return;

    setPendingDeleteIds((current) => new Set(current).add(playground.id));

    const restore = () => {
      const timer = deleteTimers.current.get(playground.id);
      if (timer !== undefined) window.clearTimeout(timer);
      deleteTimers.current.delete(playground.id);
      setPendingDeleteIds((current) => {
        const next = new Set(current);
        next.delete(playground.id);
        return next;
      });
    };

    const timer = window.setTimeout(() => {
      deleteTimers.current.delete(playground.id);
      void remove(playground.id)
        .then(() => {
          setPendingDeleteIds((current) => {
            const next = new Set(current);
            next.delete(playground.id);
            return next;
          });
          if (currentPlaygroundId === playground.id) router.push("/playground");
        })
        .catch(() => {
          restore();
          toast.error(`Could not delete ${playground.name}.`);
        });
    }, 5_000);
    deleteTimers.current.set(playground.id, timer);

    toast("Playground deleted", {
      description: playground.name,
      duration: 5_000,
      action: { label: "Undo", onClick: restore },
    });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
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
              className="border-border bg-code text-foreground placeholder:text-subtle focus-visible:ring-ring h-9 w-full rounded-md border pr-2 pl-8 text-xs outline-none focus-visible:ring-2"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void startFrom(PLAYGROUND_TEMPLATES[0]!)}
          disabled={!hydrated || creating}
          aria-label={creating ? "Creating playground" : "New playground"}
          title={creating ? "Creating playground" : "New playground"}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          <icons.plus className={cn("size-4", creating && "animate-pulse")} aria-hidden />
        </button>
      </div>

      {query.trim() ? (
        <Section title="Search results">
          <PlaygroundList
            playgrounds={results}
            currentPlaygroundId={currentPlaygroundId}
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
              onStar={(playground) => void update(playground.id, { starred: !playground.starred })}
              onDuplicate={(playground) => void handleDuplicate(playground)}
              onDelete={(playground) => void handleDelete(playground)}
            />
            {visiblePlaygrounds.length > 5 ? (
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
                playgrounds={visiblePlaygrounds}
                currentPlaygroundId={currentPlaygroundId}
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
  onStar,
  onDuplicate,
  onDelete,
}: {
  playgrounds: SavedPlayground[];
  currentPlaygroundId?: string;
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
              <icons.playground
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
                label={`Delete ${playground.name}`}
                onClick={() => onDelete(playground)}
              >
                <icons.trash className="size-3" />
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
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("rounded p-1", active ? "text-amber" : "text-subtle hover:text-foreground")}
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
