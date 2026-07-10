import type { Metadata } from "next";

import { LabWorkspace } from "@/features/playground/components/lab-workspace";

export const metadata: Metadata = { title: "Lab · Playground" };

/**
 * A saved lab — the user's own work. Labs live in browser storage, so the
 * lookup happens client-side inside LabWorkspace.
 */
export default async function PlaygroundLabPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  return <LabWorkspace key={labId} labId={labId} />;
}
