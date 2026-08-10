import type { Metadata } from "next";

import { PlaygroundLoader } from "@/features/playground/components/lab-workspace";

export const metadata: Metadata = { title: "Playground" };

export default async function SavedPlaygroundPage({
  params,
}: {
  params: Promise<{ playgroundId: string }>;
}) {
  const { playgroundId } = await params;
  return <PlaygroundLoader key={playgroundId} playgroundId={playgroundId} />;
}
