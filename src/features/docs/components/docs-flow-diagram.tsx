"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { ConceptDiagramVariant } from "@/lib/domain/mission-types";

// React Flow needs the browser; load client-side with a placeholder of the same height.
const MissionDiagram = dynamic(
  () => import("@/features/docs/mission/mission-diagram").then((m) => m.MissionDiagram),
  { ssr: false, loading: () => <Skeleton className="h-56" /> },
);

/** Fully-assembled React Flow concept diagram for the reading flow (real arrows, animated edge). */
export function DocsFlowDiagram({ variant }: { variant: ConceptDiagramVariant }) {
  return <MissionDiagram spec={{ mode: "static", variant }} />;
}
