import type { Metadata } from "next";

import { LEVEL_CATALOG } from "@/content/levels";
import { ProblemsDashboard } from "@/features/problems/components/problems-dashboard";

export const metadata: Metadata = { title: "Problems" };

/**
 * Server component: the problem catalog is static content resolved at build time and
 * passed down as serializable props. Only interactivity (filters, local progress,
 * bookmarks) lives in the client component.
 */
export default function ProblemsPage() {
  return <ProblemsDashboard catalog={[...LEVEL_CATALOG]} />;
}
