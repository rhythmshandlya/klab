import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Playground template" };

export default async function PlaygroundTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return (
    <SectionPlaceholder
      icon="playground"
      eyebrow="Sandbox template"
      title={templateId}
      description="This starter template will boot a preconfigured sandbox in the playground. The full sandbox workspace ships in Phase 4."
      phase="Phase 4"
      planned={[
        "Preloaded manifests for this template",
        "Editable multi-file workspace",
        "Apply & observe reconciliation",
        "Reset back to the template",
      ]}
      cta={{ href: "/playground", label: "Back to playground" }}
    />
  );
}
