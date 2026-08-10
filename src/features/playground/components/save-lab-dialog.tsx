"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { icons } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Small naming dialog for "Save as lab": the one moment saving needs input.
 * Controlled by the workspace toolbar; submits via button or Enter.
 */
export function SaveLabDialog({
  open,
  onOpenChange,
  suggestedName,
  title,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedName: string;
  title: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onSave(name.trim() || suggestedName);
      setName("");
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this lab.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="anim-content border-border-strong bg-panel fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-4 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]"
        >
          <Dialog.Title className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <icons.bookmark className="text-blue size-4" aria-hidden />
            {title}
          </Dialog.Title>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder={suggestedName}
            aria-label="Lab name"
            className="border-border bg-code text-foreground focus-visible:ring-ring mt-3 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
          />
          <p className="text-subtle mt-2 text-xs">
            Labs keep your files and the cluster template they run on. Find them under “My labs”.
          </p>
          {error ? <p className="text-red mt-2 text-xs">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button variant="primary" size="sm" onClick={() => void submit()} disabled={pending}>
              <icons.bookmark aria-hidden />
              {pending ? "Saving…" : "Save lab"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
