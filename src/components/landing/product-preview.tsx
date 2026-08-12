"use client";

import { useEffect, useState, type ReactNode } from "react";

import { icons } from "@/components/icons";
import { BRAND } from "@/config/brand";

const PHASES = [
  { id: "inspect", label: "Inspect" },
  { id: "fix", label: "Fix selector" },
  { id: "verify", label: "Verify" },
] as const;

const TERMINAL_OUTPUT = [
  {
    command: "kubectl get endpoints payments-svc",
    output: "payments-svc   <none>",
    tone: "text-red",
  },
  {
    command: "kubectl apply -f service.yaml",
    output: "service/payments-svc configured",
    tone: "text-amber",
  },
  {
    command: "kubectl get endpoints payments-svc",
    output: "payments-svc   10.244.1.8:8080, 10.244.2.5:8080",
    tone: "text-green",
  },
] as const;

export function ProductPreview() {
  const [phase, setPhase] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const fixed = phase >= 1;
  const recovered = phase === 2;
  const terminal = TERMINAL_OUTPUT[phase] ?? TERMINAL_OUTPUT[0];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 1) % PHASES.length),
      2800,
    );
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const selectPhase = (index: number) => {
    setAutoPlay(false);
    setPhase(index);
  };

  return (
    <figure className="border-border/90 bg-panel relative overflow-hidden rounded-2xl border shadow-2xl shadow-blue-950/20">
      <figcaption className="sr-only">
        An interactive {BRAND.name} problem showing a Service selector investigation, manifest edit,
        and recovered cluster topology.
      </figcaption>

      <div className="border-border flex h-10 items-center border-b bg-black/40 px-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="bg-border-strong size-2 rounded-full" />
          <span className="bg-border-strong size-2 rounded-full" />
          <span className="bg-border-strong size-2 rounded-full" />
        </div>
        <div className="text-subtle mx-auto flex items-center gap-2 font-mono text-[10px]">
          <icons.problems className="size-3" aria-hidden />
          Service selector mismatch
        </div>
        <span className="text-green flex items-center gap-1.5 text-[9px] font-medium uppercase">
          <span className="bg-green landing-status-pulse size-1.5 rounded-full" aria-hidden />
          Live demo
        </span>
      </div>

      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-foreground truncate text-xs font-semibold sm:text-sm">
            Restore payments traffic
          </p>
          <p className="text-subtle mt-0.5 text-[10px]">Healthy Pods, empty Service endpoints</p>
        </div>
        <StatusBadge phase={phase} />
      </div>

      <div className="grid min-h-[350px] sm:grid-cols-[1.28fr_0.72fr]">
        <section
          className="border-border min-w-0 border-b sm:border-r"
          aria-label="Manifest editor"
        >
          <div className="border-border text-muted flex h-9 items-center gap-2 border-b px-3 text-[10px]">
            <icons.yaml className="text-blue size-3" aria-hidden />
            service.yaml
            <span className={`ml-auto size-1.5 rounded-full ${fixed ? "bg-green" : "bg-amber"}`} />
          </div>

          <div className="bg-code min-h-[238px] overflow-hidden px-3 py-3 font-mono text-[9px] leading-[1.72] sm:px-4 sm:text-[10px]">
            <CodeLine number="1">
              <span className="text-blue">apiVersion:</span> <span className="text-muted">v1</span>
            </CodeLine>
            <CodeLine number="2">
              <span className="text-blue">kind:</span> <span className="text-muted">Service</span>
            </CodeLine>
            <CodeLine number="3">
              <span className="text-blue">metadata:</span>
            </CodeLine>
            <CodeLine number="4" indent>
              <span className="text-blue">name:</span>{" "}
              <span className="text-muted">payments-svc</span>
            </CodeLine>
            <CodeLine number="5">
              <span className="text-blue">spec:</span>
            </CodeLine>
            <CodeLine number="6" indent>
              <span className="text-blue">selector:</span>
            </CodeLine>
            <div
              className={`-mx-3 border-l-2 px-3 transition-colors duration-500 sm:-mx-4 sm:px-4 ${
                fixed ? "border-green bg-green/10" : "border-red bg-red/10"
              }`}
            >
              <CodeLine number="7" indent={2}>
                <span className="text-blue">app:</span>{" "}
                <span
                  key={fixed ? "fixed" : "broken"}
                  className={`landing-code-change ${fixed ? "text-green" : "text-red"}`}
                >
                  {fixed ? "payments" : "payments-v2"}
                </span>
                {phase === 1 ? <span className="landing-caret ml-0.5">|</span> : null}
              </CodeLine>
            </div>
            <CodeLine number="8" indent>
              <span className="text-blue">ports:</span>
            </CodeLine>
            <CodeLine number="9" indent={2}>
              <span className="text-blue">port:</span> <span className="text-muted">80</span>
            </CodeLine>
            <CodeLine number="10" indent={2}>
              <span className="text-blue">targetPort:</span>{" "}
              <span className="text-muted">8080</span>
            </CodeLine>
          </div>
        </section>

        <section className="border-border border-b p-4" aria-label="Cluster topology">
          <p className="text-subtle flex items-center gap-1.5 text-[9px] font-semibold tracking-wider uppercase">
            <icons.cluster className="size-3" aria-hidden />
            Cluster topology
          </p>

          <div className="mx-auto mt-5 max-w-[190px]">
            <TopologyNode
              title="payments-svc"
              detail={recovered ? "2 ready endpoints" : "0 endpoints"}
              tone={recovered ? "green" : phase === 1 ? "amber" : "red"}
              icon="service"
            />
            <div className="bg-border-strong relative mx-auto h-9 w-px" aria-hidden>
              {recovered ? (
                <span className="landing-packet bg-green absolute size-2 rounded-full" />
              ) : null}
            </div>
            <TopologyNode title="payments" detail="2 / 2 ready" tone="green" icon="deployment" />
          </div>

          <div className="text-subtle mt-5 flex items-center justify-center gap-2 text-[9px]">
            <span className={`size-1.5 rounded-full ${recovered ? "bg-green" : "bg-red"}`} />
            {recovered
              ? "Traffic restored"
              : phase === 1
                ? "Reconciling change"
                : "Route disconnected"}
          </div>
        </section>

        <section className="bg-code min-w-0 p-3 sm:col-span-2" aria-label="Terminal output">
          <div
            key={phase}
            className="landing-step-in font-mono text-[9px] leading-relaxed sm:text-[10px]"
          >
            <p className="truncate">
              <span className="text-green">$</span>{" "}
              <span className="text-muted">{terminal.command}</span>
            </p>
            <p className={`mt-1 truncate ${terminal.tone}`}>{terminal.output}</p>
          </div>
        </section>
      </div>

      <div className="border-border flex items-center gap-2 border-t bg-black/25 px-3 py-3">
        <span className="text-subtle mr-auto hidden text-[9px] uppercase sm:block">
          Try the workflow
        </span>
        {PHASES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={phase === index}
            onClick={() => selectPhase(index)}
            className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
              phase === index
                ? "border-blue/45 bg-blue/10 text-blue"
                : "border-border text-muted hover:bg-panel-hover hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
        {!autoPlay ? (
          <button
            type="button"
            onClick={() => {
              setPhase(0);
              setAutoPlay(true);
            }}
            className="border-border text-muted hover:text-foreground flex size-7 items-center justify-center rounded-md border"
            aria-label="Replay automatic demo"
          >
            <icons.reset className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>
    </figure>
  );
}

function StatusBadge({ phase }: { phase: number }) {
  const state =
    phase === 2
      ? { label: "Recovered", className: "border-green/30 bg-green/10 text-green" }
      : phase === 1
        ? { label: "Applying", className: "border-amber/30 bg-amber/10 text-amber" }
        : { label: "Degraded", className: "border-red/30 bg-red/10 text-red" };

  return (
    <span
      key={state.label}
      className={`landing-step-in ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${state.className}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {state.label}
    </span>
  );
}

function CodeLine({
  children,
  number,
  indent = 0,
}: {
  children: ReactNode;
  number: string;
  indent?: number | boolean;
}) {
  const level = indent === true ? 1 : indent === false ? 0 : indent;
  return (
    <div className="flex min-w-max">
      <span className="text-subtle mr-3 w-3 shrink-0 text-right select-none">{number}</span>
      <span style={{ paddingLeft: `${level * 12}px` }}>{children}</span>
    </div>
  );
}

function TopologyNode({
  title,
  detail,
  tone,
  icon,
}: {
  title: string;
  detail: string;
  tone: "red" | "amber" | "green";
  icon: "service" | "deployment";
}) {
  const Icon = icons[icon];
  const toneClass =
    tone === "green"
      ? "border-green/45 text-green"
      : tone === "amber"
        ? "border-amber/45 text-amber"
        : "border-red/45 text-red";

  return (
    <div
      className={`bg-panel-elevated rounded-md border p-2.5 transition-colors duration-500 ${toneClass}`}
    >
      <p className="text-foreground flex min-w-0 items-center gap-1.5 text-[10px] font-medium">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{title}</span>
      </p>
      <p className="mt-1 text-[9px]">{detail}</p>
    </div>
  );
}
