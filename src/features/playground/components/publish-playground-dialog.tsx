"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { icons } from "@/components/icons";
import type { SavedPlayground } from "@/lib/labs/contracts";

export function PublishPlaygroundDialog({
  open,
  onOpenChange,
  playground,
  onPublish,
  onUnpublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playground: SavedPlayground;
  onPublish: (description: string) => Promise<void>;
  onUnpublish: () => Promise<void>;
}) {
  const [description, setDescription] = useState(playground.description);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const published = playground.publishedCopyId !== null;

  const close = () => {
    setError(null);
    setNeedsProfile(false);
    onOpenChange(false);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) close();
    else onOpenChange(true);
  };

  const publish = async () => {
    setPending(true);
    setError(null);
    setNeedsProfile(false);
    try {
      await onPublish(description.trim());
      close();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not publish this Playground.";
      setError(message);
      setNeedsProfile(message.toLowerCase().includes("community profile"));
    } finally {
      setPending(false);
    }
  };

  const enableProfileAndPublish = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicProfile: true }),
      });
      if (!response.ok) throw new Error("Could not enable your community profile.");
      await onPublish(description.trim());
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish this Playground.");
    } finally {
      setPending(false);
    }
  };

  const unpublish = async () => {
    setPending(true);
    setError(null);
    try {
      await onUnpublish();
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unpublish this Playground.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]">
          <div className="flex items-start gap-3">
            <span className="border-blue/30 bg-blue/10 text-blue flex size-10 shrink-0 items-center justify-center rounded-lg border">
              <icons.community className="size-5" aria-hidden />
            </span>
            <div>
              <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
                {published ? "Update public Playground" : "Publish to Community"}
              </Dialog.Title>
              <Dialog.Description className="text-muted mt-1 text-sm leading-relaxed">
                KLab publishes a separate snapshot. Your working Playground stays private and later
                edits are not exposed until you publish again.
              </Dialog.Description>
            </div>
          </div>

          <label
            className="text-foreground mt-5 block text-xs font-medium"
            htmlFor="publish-description"
          >
            Description
          </label>
          <textarea
            id="publish-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What does this Playground demonstrate or reproduce?"
            className="border-border bg-code text-foreground placeholder:text-subtle focus:border-blue focus:ring-blue/20 mt-1.5 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <p className="text-subtle mt-1 text-right text-[11px]">{description.length}/500</p>

          <div className="border-amber/25 bg-amber/5 mt-4 flex gap-2.5 rounded-lg border p-3">
            <icons.validate className="text-amber mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="text-foreground text-xs font-medium">Secret safety check</p>
              <p className="text-muted mt-0.5 text-xs leading-relaxed">
                Publishing is blocked when Kubernetes Secrets, private keys, tokens, passwords, or
                other credential-like values are detected. Always review office manifests first.
              </p>
            </div>
          </div>

          {published ? (
            <p className="text-subtle mt-3 text-xs">
              {playground.forkCount} {playground.forkCount === 1 ? "fork" : "forks"} from the
              current public snapshot.
            </p>
          ) : null}

          {error ? (
            <div className="border-red/25 bg-red/5 mt-4 rounded-lg border p-3">
              <p className="text-red text-xs">{error}</p>
              {needsProfile ? (
                <button
                  type="button"
                  onClick={() => void enableProfileAndPublish()}
                  disabled={pending}
                  className="text-blue mt-2 text-xs font-semibold hover:underline disabled:opacity-60"
                >
                  Enable profile and publish
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {published ? (
              <button
                type="button"
                onClick={() => void unpublish()}
                disabled={pending}
                className="text-red hover:bg-red/10 inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Unpublish
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={pending}
                  className="border-border bg-panel text-foreground hover:bg-panel-hover inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={pending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {pending ? "Checking…" : published ? "Update snapshot" : "Publish snapshot"}
              </button>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="text-subtle hover:text-foreground absolute top-4 right-4 transition-colors"
            >
              <icons.close className="size-4" aria-hidden />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
