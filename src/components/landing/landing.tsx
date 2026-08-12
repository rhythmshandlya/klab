import { ClusterMark } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { AuthCapabilities } from "@/lib/env";

import { AreaCard } from "./area-card";
import { EntryActions } from "./entry-actions";

const AREAS = [
  {
    icon: "problems",
    title: "Problems",
    description:
      "Debug broken clusters in gamified incident labs. Read the signals, form a theory, edit real YAML, and prove your fix against hidden validators.",
    accent: "blue",
  },
  {
    icon: "playground",
    title: "Playground",
    description:
      "A free sandbox to create infra, run kubectl-style commands, apply manifests, and watch the control plane reconcile: break things and learn.",
    accent: "green",
  },
  {
    icon: "docs",
    title: "Learn",
    description:
      "Interactive lessons where concepts animate and reconcile live. Read, run inline examples, and open any snippet straight into the playground.",
    accent: "purple",
  },
] as const;

export function Landing({
  authEnabled,
  authCapabilities,
  destination,
}: {
  authEnabled: boolean;
  authCapabilities: AuthCapabilities;
  destination: string;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      <BackgroundDecor />
      <header className="border-border/80 mx-auto flex h-16 w-full max-w-5xl items-center border-b px-6">
        <div className="text-foreground flex items-center gap-2">
          <ClusterMark className="text-blue size-7" />
          <span className="text-base font-semibold tracking-tight">klab</span>
        </div>
        <p className="text-subtle ml-auto hidden text-xs sm:block">Learn. Debug. Experiment.</p>
      </header>
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-24 sm:pt-24">
        <Badge tone="neutral" className="gap-2">
          <ClusterMark className="text-blue size-3.5" />
          Kubernetes, simulated in your browser
        </Badge>

        <h1 className="text-foreground mt-6 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Learn Kubernetes by debugging real clusters, not slides.
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed text-pretty">
          klab drops you into broken infrastructure and asks you to fix it: with a live cluster, a
          real terminal, and an editable manifest. No install, no cloud bill, no risk.
        </p>

        <div className="mt-8">
          <EntryActions
            authEnabled={authEnabled}
            authCapabilities={authCapabilities}
            destination={destination}
          />
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((area) => (
            <AreaCard key={area.title} {...area} />
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
