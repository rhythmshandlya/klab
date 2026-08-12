"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import {
  DISCUSSION_CATEGORIES,
  discussionPath,
  type DiscussionCategory,
} from "@/lib/community/contracts";
import { useSession } from "@/lib/auth/client";
import type { DiscussionEntry } from "@/lib/db/discussions-repo";
import { createClientMutationId } from "@/lib/storage/progress-intent";
import { cn } from "@/lib/utils/cn";

export function NewDiscussionButton({ authEnabled }: { authEnabled: boolean }) {
  if (!authEnabled) {
    return (
      <button
        type="button"
        disabled
        title="Account services are not configured on this deployment."
        className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium opacity-50"
      >
        <icons.plus className="size-4" aria-hidden />
        New discussion
      </button>
    );
  }
  return <SessionAwareNewDiscussion />;
}

function SessionAwareNewDiscussion() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<DiscussionCategory>("general");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);

  const open = () => {
    if (!session?.user) {
      setSignInOpen(true);
      return;
    }
    setDialogOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    clientId.current ??= createClientMutationId();
    try {
      const response = await fetch("/api/community/discussions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.current,
          title,
          body,
          category,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        discussion?: DiscussionEntry;
        error?: string;
      } | null;
      if (!response.ok || !payload?.discussion) {
        throw new Error(payload?.error ?? "Could not create this discussion.");
      }
      setDialogOpen(false);
      clientId.current = null;
      setTitle("");
      setBody("");
      setCategory("general");
      router.push(discussionPath(payload.discussion));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create this discussion.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        <icons.plus className="size-4" aria-hidden />
        New discussion
      </button>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]">
            <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
              Start a discussion
            </Dialog.Title>
            <Dialog.Description className="text-muted mt-1 text-sm">
              Ask a question, report a bug, request a feature, or suggest a future Kubernetes
              problem.
            </Dialog.Description>

            <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
              <fieldset>
                <legend className="text-foreground text-xs font-medium">Category</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {DISCUSSION_CATEGORIES.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "border-border bg-panel hover:border-border-strong cursor-pointer rounded-lg border p-3 transition-colors",
                        category === option.value && "border-blue/50 bg-blue/[0.06]",
                      )}
                    >
                      <input
                        type="radio"
                        name="discussion-category"
                        value={option.value}
                        checked={category === option.value}
                        onChange={() => {
                          setCategory(option.value);
                          clientId.current = null;
                        }}
                        className="sr-only"
                      />
                      <span className="text-foreground block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-subtle mt-0.5 block text-xs">{option.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-foreground text-xs font-medium">Title</span>
                <input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clientId.current = null;
                  }}
                  minLength={6}
                  maxLength={120}
                  required
                  placeholder="Describe the question or idea clearly"
                  className="border-border bg-code text-foreground placeholder:text-subtle focus:border-blue focus:ring-blue/20 mt-1.5 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="text-foreground text-xs font-medium">Details</span>
                <textarea
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    clientId.current = null;
                  }}
                  minLength={12}
                  maxLength={10_000}
                  required
                  rows={7}
                  placeholder="Include what you expected, what happened, or how the proposed problem should work."
                  className="border-border bg-code text-foreground placeholder:text-subtle focus:border-blue focus:ring-blue/20 mt-1.5 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2"
                />
                <span className="text-subtle mt-1 block text-right text-[11px]">
                  {body.length}/10,000
                </span>
              </label>

              <p className="text-subtle text-xs leading-relaxed">
                Discussions are public and appear under your account name. Never post cluster
                credentials, access tokens, or private company data.
              </p>
              {error ? (
                <p className="text-red text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
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
                  type="submit"
                  disabled={pending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {pending ? "Publishing…" : "Publish discussion"}
                </button>
              </div>
            </form>

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
    </>
  );
}
