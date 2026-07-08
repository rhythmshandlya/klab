import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/content/playground-templates";
import { PlaygroundWorkspace } from "@/features/playground/components/playground-workspace";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  const template = getTemplateById(DEFAULT_TEMPLATE_ID);
  if (!template) notFound();
  return <PlaygroundWorkspace key={template.id} template={template} />;
}
