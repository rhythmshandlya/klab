import type { Metadata } from "next";

import { LabWorkspace } from "@/features/playground/components/lab-workspace";

export const metadata: Metadata = { title: "Playground" };

/** Compatibility route for bookmarks created before the Playground rename. */
export default async function PlaygroundLabPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  return <LabWorkspace key={labId} labId={labId} />;
}
