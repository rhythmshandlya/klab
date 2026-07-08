import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Docs" };

export default function DocsPage() {
  return (
    <SectionPlaceholder
      icon="docs"
      eyebrow="Interactive study"
      title="Docs"
      description="Kubernetes docs that teach by doing. Every major page pairs a clear explanation with a runnable mini-lab: edit the desired state, apply it, and watch the cluster reconcile toward it live."
      phase="Phase 5"
      planned={[
        "Sectioned docs navigation",
        "MDX lessons with concept cards",
        "Inline interactive labs",
        "Live desired-vs-actual visualizations",
        "Table of contents & progress",
        "Open in Playground on every example",
        "Related problem level per concept",
      ]}
      cta={{ href: "/docs/foundations/desired-vs-actual-state", label: "Preview a lesson" }}
    />
  );
}
