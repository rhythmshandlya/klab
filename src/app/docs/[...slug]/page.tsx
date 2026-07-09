import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DOCS_LESSONS, getLessonBySlug } from "@/content/docs";
import { DocsPage } from "@/features/docs/components/docs-page";

export function generateStaticParams() {
  return DOCS_LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  return { title: lesson ? lesson.title : "Docs" };
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) notFound();
  return <DocsPage lesson={lesson} />;
}
