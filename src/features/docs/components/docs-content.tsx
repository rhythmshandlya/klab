import { type ReactNode } from "react";

import { ClusterMark, icons } from "@/components/icons";
import type { DocsBlock, DocsLesson } from "@/lib/domain/types";
import { assertNever } from "@/lib/utils/exhaustive";
import { cn } from "@/lib/utils/cn";

import { DocsQuiz } from "./docs-quiz";
import { InteractiveLab } from "./interactive-lab";

const CALLOUT: Record<"info" | "warning" | "key", { border: string; icon: keyof typeof icons }> = {
  info: { border: "border-blue/30 bg-blue/5", icon: "docs" },
  warning: { border: "border-amber/30 bg-amber/5", icon: "warning" },
  key: { border: "border-purple/30 bg-purple/5", icon: "xp" },
};

type DiagramBlock = Extract<DocsBlock, { type: "diagram" }>;

export function DocsContent({ lesson }: { lesson: DocsLesson }) {
  return (
    <div className="space-y-6">
      {lesson.content.map((block, i) => (
        <Block key={i} block={block} lesson={lesson} />
      ))}
    </div>
  );
}

function Block({ block, lesson }: { block: DocsBlock; lesson: DocsLesson }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          id={block.id}
          className="text-foreground scroll-mt-20 pt-3 text-lg font-semibold tracking-tight"
        >
          {block.text}
        </h2>
      );
    case "paragraph":
      return <p className="text-muted max-w-3xl text-[15px] leading-relaxed">{block.text}</p>;
    case "callout": {
      const style = CALLOUT[block.tone];
      const Icon = icons[style.icon];
      return (
        <div className={cn("flex gap-3 rounded-md border p-4", style.border)}>
          <Icon className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            {block.title ? (
              <p className="text-foreground text-sm font-semibold">{block.title}</p>
            ) : null}
            <p className="text-muted text-sm leading-relaxed">{block.text}</p>
          </div>
        </div>
      );
    }
    case "concept":
      return (
        <div className="border-border bg-panel rounded-md border p-4">
          <p className="text-foreground text-sm font-semibold">{block.term}</p>
          <p className="text-muted mt-1 text-sm leading-relaxed">{block.definition}</p>
        </div>
      );
    case "code":
      return <CodePanel code={block.code} />;
    case "compare":
      return (
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[block.left, block.right].map((side, i) => (
              <CodeCard key={i} title={side.title} code={side.code} />
            ))}
          </div>
          {block.caption ? (
            <p className="text-subtle mt-2 text-center text-xs">{block.caption}</p>
          ) : null}
        </div>
      );
    case "diagram":
      return <NativeDiagram block={block} />;
    case "demo":
      return <GuidedDemo block={block} />;
    case "quiz":
      return <DocsQuiz quiz={block} />;
    case "steps":
      return <StepsBlock block={block} />;
    case "takeaways":
      return <TakeawaysBlock items={block.items} />;
    case "lab": {
      const lab = lesson.labs.find((l) => l.id === block.labId);
      if (!lab) return null;
      return <InteractiveLab lab={lab} />;
    }
    default:
      return assertNever(block);
  }
}

function NativeDiagram({ block }: { block: DiagramBlock }) {
  switch (block.variant) {
    case "control-loop":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="relative min-h-64 overflow-hidden">
            <LoopArrows />
            <div className="relative z-10 grid gap-5 p-5 lg:grid-cols-[1fr_220px_1fr] lg:items-center">
              <div>
                <p className="text-foreground text-sm font-semibold">You declare</p>
                <p className="text-subtle mt-1 text-xs">Desired state</p>
                <CodeCard
                  className="mt-3"
                  title="deployment.yaml"
                  code={"spec:\n  replicas: 3\n  selector:\n    app: web"}
                />
              </div>
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <div className="bg-blue/15 text-blue border-blue/40 flex size-20 items-center justify-center rounded-md border shadow-[0_0_40px_rgb(0_112_243/0.25)]">
                  <ClusterMark className="size-10" aria-hidden />
                </div>
                <p className="text-foreground mt-3 text-sm font-semibold">Control plane</p>
                <p className="text-muted mt-1 max-w-40 text-xs leading-relaxed">
                  Observe, diff, and act until the cluster matches the spec.
                </p>
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">Cluster runs</p>
                <p className="text-subtle mt-1 text-xs">Actual state</p>
                <CodeCard
                  className="mt-3"
                  title="status"
                  code={"replicas: 3\nready: 3\nupdated: 3"}
                />
              </div>
            </div>
          </div>
        </DiagramShell>
      );
    case "cluster-architecture":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <ObjectNode
                tone="blue"
                title="API server"
                detail="Validates requests and writes objects."
              />
              <ObjectNode tone="purple" title="etcd" detail="Stores desired and observed state." />
              <ObjectNode
                tone="green"
                title="Controllers"
                detail="Reconcile objects into action."
              />
              <ObjectNode
                tone="amber"
                title="Scheduler"
                detail="Chooses a node for pending Pods."
              />
            </div>
            <div className="border-border bg-code/60 rounded-md border p-4">
              <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
                Worker node
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ObjectNode tone="blue" title="kubelet" detail="Runs Pod specs." />
                <ObjectNode tone="green" title="kube-proxy" detail="Programs Service traffic." />
                <ObjectNode tone="purple" title="Container runtime" detail="Starts containers." />
                <ObjectNode tone="green" title="Pods" detail="App containers live here." />
              </div>
            </div>
          </div>
        </DiagramShell>
      );
    case "api-object":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_0.8fr]">
            <CodeCard
              title="Object"
              code={
                "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\nstatus:\n  readyReplicas: 3"
              }
            />
            <div className="grid gap-3">
              <ObjectNode
                tone="blue"
                title="metadata"
                detail="Name, namespace, labels, annotations."
              />
              <ObjectNode tone="green" title="spec" detail="The desired state you own." />
              <ObjectNode
                tone="purple"
                title="status"
                detail="The observed state controllers update."
              />
            </div>
          </div>
        </DiagramShell>
      );
    case "pod":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="p-5">
            <div className="border-blue/40 bg-blue/5 rounded-md border p-4">
              <p className="text-foreground text-sm font-semibold">Pod: web</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ObjectNode tone="green" title="Container" detail="klab/web-app:1.0.0" />
                <ObjectNode tone="blue" title="Probe" detail="GET /healthz" />
                <ObjectNode tone="purple" title="Network" detail="One Pod IP, shared ports." />
              </div>
            </div>
          </div>
        </DiagramShell>
      );
    case "workload-hierarchy":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <HierarchyDiagram />
        </DiagramShell>
      );
    case "service-routing":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <FlowRow
            items={[
              ["Client", "curl http://web-svc"],
              ["DNS", "web-svc.default.svc"],
              ["Service", "stable virtual IP"],
              ["EndpointSlice", "ready Pod IPs only"],
              ["Pods", "traffic lands here"],
            ]}
          />
        </DiagramShell>
      );
    case "probe-gates":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <ObjectNode
              tone="blue"
              title="Readiness"
              detail="Failing readiness removes the Pod from Service endpoints. The container keeps running."
            />
            <ObjectNode
              tone="amber"
              title="Liveness"
              detail="Failing liveness restarts the container. Use it for stuck processes, not startup slowness."
            />
          </div>
        </DiagramShell>
      );
    case "rollout":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <ReplicaSetBox
              title="Old ReplicaSet"
              tone="blue"
              pods={["ready", "ready", "terminating"]}
            />
            <icons.arrowRight className="text-blue mx-auto hidden size-6 lg:block" aria-hidden />
            <ReplicaSetBox
              title="New ReplicaSet"
              tone="green"
              pods={["ready", "creating", "pending"]}
            />
          </div>
        </DiagramShell>
      );
    case "namespace-boundary":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <NamespaceBox name="team-a" service="api-svc" app="api" />
            <NamespaceBox name="team-b" service="api-svc" app="api" />
          </div>
        </DiagramShell>
      );
    case "debug-loop":
      return (
        <DiagramShell title={block.title} caption={block.caption}>
          <FlowRow
            items={[
              ["Symptom", "Request fails"],
              ["Inspect", "get, describe, logs, events"],
              ["Evidence", "selector or probe mismatch"],
              ["Patch", "change YAML"],
              ["Verify", "behavior passes"],
            ]}
          />
        </DiagramShell>
      );
    default:
      return assertNever(block.variant);
  }
}

function GuidedDemo({ block }: { block: Extract<DocsBlock, { type: "demo" }> }) {
  return (
    <div className="border-border bg-panel overflow-hidden rounded-md border">
      <div className="border-border flex items-start gap-3 border-b px-4 py-3">
        <icons.terminal className="text-green mt-0.5 size-4" aria-hidden />
        <div>
          <p className="text-foreground text-sm font-semibold">{block.title}</p>
          <p className="text-muted mt-1 text-sm">{block.description}</p>
        </div>
      </div>
      <ol className="divide-border divide-y">
        {block.steps.map((step, index) => (
          <li key={step.label} className="grid gap-3 p-4 md:grid-cols-[150px_1fr]">
            <div>
              <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
                Step {index + 1}
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">{step.label}</p>
            </div>
            <div>
              <p className="text-muted text-sm leading-relaxed">{step.detail}</p>
              {step.command ? <TerminalLine command={step.command} output={step.output} /> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepsBlock({ block }: { block: Extract<DocsBlock, { type: "steps" }> }) {
  return (
    <div className="space-y-3">
      {block.title ? <p className="text-foreground text-sm font-semibold">{block.title}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {block.items.map((item, index) => (
          <div key={item.title} className="border-border bg-panel rounded-md border p-4">
            <p className="text-blue font-mono text-xs">0{index + 1}</p>
            <p className="text-foreground mt-2 text-sm font-semibold">{item.title}</p>
            <p className="text-muted mt-1 text-sm leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TakeawaysBlock({ items }: { items: string[] }) {
  return (
    <div className="border-green/30 bg-green/5 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <icons.success className="text-green size-4" aria-hidden />
        <p className="text-foreground text-sm font-semibold">Key takeaways</p>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-muted flex gap-2 text-sm leading-relaxed">
            <span className="text-green mt-0.5" aria-hidden>
              -
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagramShell({
  title,
  caption,
  children,
}: {
  title?: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="border-border bg-panel overflow-hidden rounded-md border">
      {title ? (
        <figcaption className="border-border text-subtle border-b px-4 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
          {title}
        </figcaption>
      ) : null}
      <div className="bg-[radial-gradient(circle_at_50%_0%,rgb(0_112_243/0.14),transparent_35%),linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px]">
        {children}
      </div>
      {caption ? (
        <p className="border-border text-subtle border-t px-4 py-2 text-center text-xs">
          {caption}
        </p>
      ) : null}
    </figure>
  );
}

function LoopArrows() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 900 260"
      preserveAspectRatio="none"
    >
      <path
        d="M240 64 C380 8 520 8 660 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue"
      />
      <path
        d="M660 196 C520 252 380 252 240 196"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-green"
      />
    </svg>
  );
}

function CodeCard({ title, code, className }: { title: string; code: string; className?: string }) {
  return (
    <div className={cn("border-border bg-code/90 overflow-hidden rounded-md border", className)}>
      <p className="border-border text-subtle border-b px-3 py-1.5 font-mono text-[11px]">
        {title}
      </p>
      <pre className="text-muted overflow-x-auto p-3 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function CodePanel({ code }: { code: string }) {
  return (
    <pre className="border-border bg-code text-muted overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
      {code}
    </pre>
  );
}

function ObjectNode({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "purple";
}) {
  const toneClass = {
    blue: "border-blue/35 bg-blue/10",
    green: "border-green/35 bg-green/10",
    amber: "border-amber/35 bg-amber/10",
    purple: "border-purple/35 bg-purple/10",
  }[tone];
  return (
    <div className={cn("rounded-md border p-3", toneClass)}>
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted mt-1 text-xs leading-relaxed">{detail}</p>
    </div>
  );
}

function HierarchyDiagram() {
  return (
    <div className="space-y-4 p-5">
      <ObjectNode
        tone="green"
        title="Deployment"
        detail="Owns the rollout strategy and desired replicas."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ObjectNode
          tone="blue"
          title="ReplicaSet: current"
          detail="Keeps the current Pod template at scale."
        />
        <ObjectNode
          tone="amber"
          title="ReplicaSet: previous"
          detail="Kept around for rollback history."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["web-7d5f6b6c7-a8c12", "web-7d5f6b6c7-def34", "web-7d5f6b6c7-ghi56"].map((name) => (
          <div key={name} className="border-blue/35 bg-blue/10 rounded-md border p-3">
            <p className="text-foreground truncate font-mono text-xs">{name}</p>
            <p className="text-green mt-2 text-xs font-medium">Running and Ready</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowRow({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 p-5 md:grid-cols-5">
      {items.map(([title, detail], index) => (
        <div key={title} className="flex items-stretch gap-3 md:block">
          <div className="border-border bg-code/70 h-full rounded-md border p-3">
            <p className="text-foreground text-sm font-semibold">{title}</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">{detail}</p>
          </div>
          {index < items.length - 1 ? (
            <icons.arrowRight className="text-blue mt-4 hidden size-4 shrink-0 md:mx-auto md:mt-3 md:block" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReplicaSetBox({
  title,
  tone,
  pods,
}: {
  title: string;
  tone: "blue" | "green";
  pods: string[];
}) {
  return (
    <div className="border-border bg-code/60 rounded-md border p-4">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {pods.map((pod, index) => (
          <span
            key={`${pod}-${index}`}
            className={cn(
              "rounded border px-2 py-3 text-center text-[11px]",
              tone === "green"
                ? "border-green/35 bg-green/10 text-green"
                : "border-blue/35 bg-blue/10 text-blue",
            )}
          >
            {pod}
          </span>
        ))}
      </div>
    </div>
  );
}

function NamespaceBox({ name, service, app }: { name: string; service: string; app: string }) {
  return (
    <div className="border-border bg-code/60 rounded-md border p-4">
      <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
        namespace/{name}
      </p>
      <div className="mt-3 grid gap-3">
        <ObjectNode
          tone="blue"
          title={`Service ${service}`}
          detail={`${service}.${name}.svc.cluster.local`}
        />
        <ObjectNode
          tone="green"
          title={`Pod app=${app}`}
          detail="Only selected inside the same namespace."
        />
      </div>
    </div>
  );
}

function TerminalLine({ command, output }: { command: string; output?: string }) {
  return (
    <div className="border-border bg-terminal mt-3 overflow-hidden rounded-md border font-mono text-xs">
      <p className="text-green border-border border-b px-3 py-2">$ {command}</p>
      {output ? (
        <pre className="text-muted overflow-x-auto px-3 py-2 leading-relaxed">{output}</pre>
      ) : null}
    </div>
  );
}
