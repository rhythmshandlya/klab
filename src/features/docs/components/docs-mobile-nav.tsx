"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useState } from "react";

import { icons } from "@/components/icons";
import type { CurriculumCatalog } from "@/content/curriculum/model";

import { DocsSidebar } from "./docs-sidebar";

/**
 * Mobile-only ({@code lg:hidden}) entry to the section navigation. Below the lg
 * breakpoint the left sidebar is hidden, which previously stranded readers on a single
 * lesson with no way to move. This slides the same DocsSidebar in from the left as a
 * Radix Dialog drawer and closes on selection.
 */
export function DocsMobileNav({
  catalog,
  sectionLabel,
}: {
  catalog: CurriculumCatalog;
  sectionLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="border-border bg-panel text-foreground hover:bg-panel-hover flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors lg:hidden"
        >
          <icons.menu className="text-subtle size-4" aria-hidden />
          Lessons
          <span className="text-subtle">· {sectionLabel}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" />
        <Dialog.Content className="anim-drawer-left border-border bg-panel-elevated fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col border-r shadow-2xl lg:hidden">
          <Dialog.Title asChild>
            <VisuallyHidden>Learning navigation</VisuallyHidden>
          </Dialog.Title>
          <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
            <span className="text-foreground text-sm font-semibold">Learn</span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close navigation"
                className="text-subtle hover:text-foreground hover:bg-panel-hover rounded-md p-1.5 transition-colors"
              >
                <icons.close className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <DocsSidebar catalog={catalog} onNavigate={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
