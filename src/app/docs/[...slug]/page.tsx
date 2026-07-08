import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/ui/section-placeholder";

export const metadata: Metadata = { title: "Docs" };

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join(" / ");
  return (
    <SectionPlaceholder
      icon="docsInteractive"
      eyebrow="Lesson"
      title={path}
      description="This interactive lesson is under construction. Phase 5 delivers the docs experience with MDX content and inline labs that run against the same in-browser cluster simulation used by Problems and Playground."
      phase="Phase 5"
      planned={[
        "MDX explanation with diagrams",
        "Runnable inline lab",
        "Live reconciliation visualization",
        "Open in Playground",
        "Related problem level",
      ]}
      cta={{ href: "/docs", label: "Back to docs" }}
    />
  );
}
