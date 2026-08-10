import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLevelBySlug, LEVELS } from "@/content/levels";
import { LevelWorkspace } from "@/features/problems/components/level-workspace";

export function generateStaticParams() {
  return LEVELS.map((level) => ({ levelId: level.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ levelId: string }>;
}): Promise<Metadata> {
  const { levelId } = await params;
  const level = getLevelBySlug(levelId);
  return { title: level ? level.title : "Level" };
}

export default async function LevelPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  const level = getLevelBySlug(levelId);
  if (!level) notFound();
  return <LevelWorkspace level={level} />;
}
