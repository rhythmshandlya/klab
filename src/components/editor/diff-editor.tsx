"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const MonacoDiff = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: () => <Skeleton className="m-3 h-[calc(100%-1.5rem)]" />,
});

export interface DiffViewProps {
  original: string;
  modified: string;
}

/** Read-only side-by-side diff of the initial manifest vs. the learner's edits. */
export function DiffView({ original, modified }: DiffViewProps) {
  return (
    <MonacoDiff
      original={original}
      modified={modified}
      language="yaml"
      theme="klab-dark"
      options={{
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 20,
        renderSideBySide: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
      loading={<Skeleton className="m-3 h-[calc(100%-1.5rem)]" />}
    />
  );
}
