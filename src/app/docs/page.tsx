import type { Metadata } from "next";

import { getCurriculumCatalog } from "@/content/curriculum/server";
import { DocsHome } from "@/features/docs/components/docs-home";

export const metadata: Metadata = { title: "Docs" };

export default function DocsIndexPage() {
  return <DocsHome catalog={getCurriculumCatalog()} />;
}
