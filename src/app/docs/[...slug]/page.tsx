import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DOCS_LESSONS, getLessonBySlug } from "@/content/docs";
import { getMissionBySlug, getMissionsBySection, MISSION_SECTIONS } from "@/content/missions";
import { DocsPage } from "@/features/docs/components/docs-page";
import { SectionPlayer } from "@/features/docs/mission/section-player";
import { resolveDocsRoute } from "@/app/docs/resolve-route";

export function generateStaticParams() {
  const params = new Map<string, { slug: string[] }>();

  for (const lesson of DOCS_LESSONS) {
    params.set(lesson.slug.join("/"), { slug: lesson.slug });
  }
  for (const section of MISSION_SECTIONS) {
    for (const mission of getMissionsBySection(section)) {
      params.set(mission.slug.join("/"), { slug: mission.slug });
    }
    const bareSlug = getMissionsBySection(section)[0]?.slug[0];
    if (bareSlug) params.set(bareSlug, { slug: [bareSlug] });
  }

  return Array.from(params.values());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = resolveDocsRoute(slug);
  if (route.kind === "mission") {
    const mission = getMissionBySlug(slug) ?? getMissionsBySection(route.section)[0];
    if (mission) return { title: mission.title };
  }
  const lesson = getLessonBySlug(slug);
  return { title: lesson ? lesson.title : "Docs" };
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const route = resolveDocsRoute(slug);
  if (route.kind === "mission") {
    return (
      <SectionPlayer section={route.section} initialSlug={slug.length > 1 ? slug : undefined} />
    );
  }
  if (route.kind === "legacy") {
    const lesson = getLessonBySlug(slug);
    if (lesson) return <DocsPage lesson={lesson} />;
  }
  notFound();
}
