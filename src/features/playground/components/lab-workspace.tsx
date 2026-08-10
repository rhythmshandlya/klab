"use client";

import Link from "next/link";
import { useEffect } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/content/playground-templates";

import { useLabsStore } from "../labs-store";
import { PlaygroundWorkspace } from "./playground-workspace";

export function LabWorkspace({ labId }: { labId: string }) {
  const labs = useLabsStore((state) => state.labs);
  const hydrated = useLabsStore((state) => state.hydrated);
  const error = useLabsStore((state) => state.error);
  const hydrate = useLabsStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="text-subtle text-sm">Opening lab…</p>
      </div>
    );
  }

  const lab = labs.find((candidate) => candidate.id === labId);
  if (!lab) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3">
        <icons.warning className="text-amber size-6" aria-hidden />
        <p className="text-foreground text-sm font-medium">This lab could not be opened.</p>
        <p className="text-subtle max-w-sm text-center text-xs leading-relaxed">
          {error ?? "It may have been deleted or belong to a different account."}
        </p>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/playground">Back to the playground</Link>
        </Button>
      </div>
    );
  }

  const template = getTemplateById(lab.templateId) ?? getTemplateById(DEFAULT_TEMPLATE_ID);
  if (!template) return null;
  return <PlaygroundWorkspace key={lab.id} template={template} lab={lab} />;
}
