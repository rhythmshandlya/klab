"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/content/playground-templates";
import { getLab, type SavedLab } from "@/lib/storage/local-labs";

import { PlaygroundWorkspace } from "./playground-workspace";

/**
 * Client-side resolver for /playground/lab/[labId]: labs live in localStorage,
 * so the lookup can only happen after mount. Resolves the lab and its template,
 * then renders the normal workspace in lab mode.
 */
export function LabWorkspace({ labId }: { labId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | {
        status: "ready";
        lab: SavedLab;
      }
  >({ status: "loading" });

  useEffect(() => {
    const lab = getLab(labId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setState(lab ? { status: "ready", lab } : { status: "missing" });
  }, [labId]);

  if (state.status === "loading") {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="text-subtle text-sm">Opening lab…</p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3">
        <icons.warning className="text-amber size-6" aria-hidden />
        <p className="text-foreground text-sm font-medium">This lab doesn&apos;t exist here.</p>
        <p className="text-subtle max-w-sm text-center text-xs leading-relaxed">
          Labs are stored in this browser. It may have been deleted, or saved on another device.
        </p>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/playground">Back to the playground</Link>
        </Button>
      </div>
    );
  }

  const template = getTemplateById(state.lab.templateId) ?? getTemplateById(DEFAULT_TEMPLATE_ID);
  if (!template) return null;
  return <PlaygroundWorkspace key={state.lab.id} template={template} lab={state.lab} />;
}
