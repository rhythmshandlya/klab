import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Level" };

export default async function LevelPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  return (
    <SectionPlaceholder
      icon="problems"
      eyebrow="Incident lab"
      title={levelId}
      description="This level's full investigation workspace is under construction. Phase 3 delivers the Broken Readiness Probe level end-to-end as the polished reference, with the terminal, editor, topology, evidence board and validators fully wired."
      phase="Phase 3"
      planned={[
        "Incident brief, objective & constraints",
        "Editable deployment.yaml in Monaco",
        "Terminal-driven investigation",
        "Live cluster explorer & object details",
        "Events timeline & network probe",
        "Run Validation with success state",
      ]}
      cta={{ href: "/problems", label: "Back to all problems" }}
    />
  );
}
