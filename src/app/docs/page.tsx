import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_LESSON_SLUG, getLessonBySlug } from "@/content/docs";
import { DocsPage } from "@/features/docs/components/docs-page";

export const metadata: Metadata = { title: "Docs" };

export default function DocsIndexPage() {
  const lesson = getLessonBySlug(DEFAULT_LESSON_SLUG);
  if (!lesson) notFound();
  return <DocsPage lesson={lesson} />;
}
