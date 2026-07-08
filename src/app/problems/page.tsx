import type { Metadata } from "next";

import { LevelList } from "@/features/problems/components/level-list";

export const metadata: Metadata = { title: "Problems" };

export default function ProblemsPage() {
  return <LevelList />;
}
