"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/content/playground-templates";

import { usePlaygroundsStore } from "../labs-store";
import { PlaygroundWorkspace } from "./playground-workspace";

export function PlaygroundLoader({ playgroundId }: { playgroundId: string }) {
  const router = useRouter();
  const playgrounds = usePlaygroundsStore((state) => state.playgrounds);
  const claimedId = usePlaygroundsStore((state) => state.claimedIds[playgroundId]);
  const hydrated = usePlaygroundsStore((state) => state.hydrated);
  const error = usePlaygroundsStore((state) => state.error);
  const hydrate = usePlaygroundsStore((state) => state.hydrate);
  const open = usePlaygroundsStore((state) => state.open);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && playgrounds.some((candidate) => candidate.id === playgroundId)) {
      void open(playgroundId).catch(() => undefined);
    }
    // Opening is a once-per-route visit action; list updates must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, open, playgroundId]);

  useEffect(() => {
    if (claimedId) router.replace(`/playground/p/${claimedId}`);
  }, [claimedId, router]);

  if (!hydrated) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="text-subtle text-sm">Opening playground…</p>
      </div>
    );
  }

  const playground = playgrounds.find((candidate) => candidate.id === playgroundId);
  if (claimedId) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="text-subtle text-sm">Moving your playground into your account…</p>
      </div>
    );
  }
  if (!playground) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3">
        <icons.warning className="text-amber size-6" aria-hidden />
        <p className="text-foreground text-sm font-medium">This playground could not be opened.</p>
        <p className="text-subtle max-w-sm text-center text-xs leading-relaxed">
          {error ?? "It may have been deleted or belong to a different account."}
        </p>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/playground">Back to Playgrounds</Link>
        </Button>
      </div>
    );
  }

  const template = getTemplateById(playground.templateId) ?? getTemplateById(DEFAULT_TEMPLATE_ID);
  if (!template) return null;
  return <PlaygroundWorkspace key={playground.id} template={template} playground={playground} />;
}

/** @deprecated Compatibility for existing /playground/lab/:id bookmarks. */
export function LabWorkspace({ labId }: { labId: string }) {
  return <PlaygroundLoader playgroundId={labId} />;
}
