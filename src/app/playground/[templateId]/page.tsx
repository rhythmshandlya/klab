import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTemplateById, PLAYGROUND_TEMPLATES } from "@/content/playground-templates";
import { PlaygroundWorkspace } from "@/features/playground/components/playground-workspace";

export function generateStaticParams() {
  return PLAYGROUND_TEMPLATES.map((t) => ({ templateId: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;
  const template = getTemplateById(templateId);
  return { title: template ? `${template.title} · Playground` : "Playground" };
}

export default async function PlaygroundTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = getTemplateById(templateId);
  if (!template) notFound();
  return <PlaygroundWorkspace key={template.id} template={template} />;
}
