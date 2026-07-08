import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return (
    <SectionPlaceholder
      icon="playground"
      eyebrow="Sandbox"
      title="Playground"
      description="A free Kubernetes scratchpad. Start from a template or an empty cluster, edit manifests across multiple files, apply them, and watch the control plane reconcile in a live topology. Break things on purpose and learn how the pieces fit."
      phase="Phase 4"
      planned={[
        "Starter templates & saved sandboxes",
        "Multi-file YAML workspace",
        "kubectl-style terminal",
        "Live cluster topology (React Flow)",
        "Object explorer with spec vs status",
        "Events stream & resource summary",
        "Save / load local sandbox state",
        "Copy shareable YAML snippets",
      ]}
      cta={{ href: "/playground/deployment-service", label: "Preview a template" }}
    />
  );
}
