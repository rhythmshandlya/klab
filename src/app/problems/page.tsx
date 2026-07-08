import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Problems" };

export default function ProblemsPage() {
  return (
    <SectionPlaceholder
      icon="problems"
      eyebrow="Incident labs"
      title="Problems"
      description="Gamified Kubernetes incident debugging. Each level drops you into a broken cluster with a story, constraints, and an editable manifest. Investigate with a real terminal, gather evidence, and prove your fix against behavior-based validators."
      phase="Phase 3"
      planned={[
        "Level list with difficulty, severity and XP",
        "Three-column investigation workspace",
        "Monaco YAML editor with diff mode",
        "xterm.js terminal + kubectl subset",
        "React Flow service topology",
        "Evidence board & progressive hints",
        "Behavior-based Run Validation",
        "Post-solve root-cause explanation",
      ]}
      cta={{ href: "/problems/broken-readiness-probe", label: "Preview the reference level" }}
    />
  );
}
