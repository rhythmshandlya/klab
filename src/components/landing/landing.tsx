import Link from "next/link";

import { ClusterMark, icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import { AreaCard } from "./area-card";

const AREAS = [
  {
    href: "/problems",
    icon: "problems",
    title: "Problems",
    description:
      "Debug broken clusters in gamified incident labs. Read the signals, form a theory, edit real YAML, and prove your fix against hidden validators.",
    accent: "blue",
  },
  {
    href: "/playground",
    icon: "playground",
    title: "Playground",
    description:
      "A free sandbox to create infra, run kubectl-style commands, apply manifests, and watch the control plane reconcile — break things and learn.",
    accent: "green",
  },
  {
    href: "/docs",
    icon: "docs",
    title: "Learn",
    description:
      "Interactive lessons where concepts animate and reconcile live. Read, run inline examples, and open any snippet straight into the playground.",
    accent: "purple",
  },
] as const;

export function Landing() {
  const Run = icons.run;
  return (
    <div className="relative isolate overflow-hidden">
      <BackgroundDecor />
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
        <Badge tone="neutral" className="gap-2">
          <ClusterMark className="text-blue size-3.5" />
          Kubernetes, simulated in your browser
        </Badge>

        <h1 className="text-foreground mt-6 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Learn Kubernetes by debugging real clusters, not slides.
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed text-pretty">
          klab drops you into broken infrastructure and asks you to fix it — with a live cluster, a
          real terminal, and an editable manifest. No install, no cloud bill, no risk.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/problems/broken-readiness-probe"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Run className="size-4" aria-hidden />
            Start the reference incident
          </Link>
          <Link
            href="/docs"
            className="border-border bg-panel text-foreground hover:border-border-strong hover:bg-panel-hover focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Start learning
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((area) => (
            <AreaCard key={area.href} {...area} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Tasteful, subtle atmosphere: a top radial glow over a faint grid. */
function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--color-blue) 14%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--color-foreground) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent 80%)",
        }}
      />
    </div>
  );
}
