import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { curriculumLessons } from "@/content/curriculum/model";
import { getCurriculumCatalog, getCurriculumLesson } from "@/content/curriculum/server";
import { DocsPage } from "@/features/docs/components/docs-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return curriculumLessons(getCurriculumCatalog()).map((lesson) => ({
    slug: lesson.key.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const key = slug.join("/");
  const summary = curriculumLessons(getCurriculumCatalog()).find((lesson) => lesson.key === key);
  return { title: summary?.title ?? "Docs" };
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = getCurriculumLesson(slug);
  if (!page) notFound();
  return <DocsPage page={page} />;
}
