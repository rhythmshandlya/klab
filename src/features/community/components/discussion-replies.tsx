"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import type { DiscussionReplyEntry } from "@/lib/db/discussions-repo";
import type { DiscussionStatus } from "@/lib/community/contracts";
import { useSession } from "@/lib/auth/client";
import { createClientMutationId } from "@/lib/storage/progress-intent";

import { timeAgo } from "../format";
import { DiscussionAuthorLine } from "./discussion-card";

export function DiscussionReplies({
  discussionId,
  replies,
  status,
  authEnabled,
  now,
}: {
  discussionId: string;
  replies: readonly DiscussionReplyEntry[];
  status: DiscussionStatus;
  authEnabled: boolean;
  now: string;
}) {
  const roots = replies.filter((reply) => reply.parentId === null);
  const children = new Map<string, DiscussionReplyEntry[]>();
  for (const reply of replies) {
    if (!reply.parentId) continue;
    children.set(reply.parentId, [...(children.get(reply.parentId) ?? []), reply]);
  }

  return (
    <section aria-labelledby="responses-heading" className="mt-10">
      <div className="flex items-center gap-2">
        <icons.discussion className="text-blue size-4" aria-hidden />
        <h2 id="responses-heading" className="text-foreground text-sm font-semibold">
          {replies.length} {replies.length === 1 ? "response" : "responses"}
        </h2>
      </div>

      {status === "closed" ? (
        <p className="border-border bg-panel text-muted mt-3 rounded-lg border px-4 py-3 text-sm">
          This discussion is closed to new responses.
        </p>
      ) : authEnabled ? (
        <SessionReplyComposer discussionId={discussionId} />
      ) : null}

      {roots.length === 0 ? (
        <div className="border-border bg-panel mt-4 rounded-xl border px-5 py-8 text-center">
          <p className="text-foreground text-sm font-medium">No responses yet</p>
          <p className="text-muted mt-1 text-sm">Add context, an answer, or your own experience.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {roots.map((reply) => (
            <li key={reply.id}>
              <ReplyCard reply={reply} now={now}>
                {status !== "closed" && authEnabled ? (
                  <SessionReplyButton discussionId={discussionId} parent={reply} />
                ) : null}
              </ReplyCard>
              {(children.get(reply.id) ?? []).length > 0 ? (
                <ol className="border-border mt-2 ml-6 space-y-2 border-l pl-3 sm:ml-10">
                  {(children.get(reply.id) ?? []).map((child) => (
                    <li key={child.id}>
                      <ReplyCard reply={child} now={now} nested />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReplyCard({
  reply,
  now,
  nested = false,
  children,
}: {
  reply: DiscussionReplyEntry;
  now: string;
  nested?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className="border-border bg-panel rounded-xl border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DiscussionAuthorLine author={reply.author} />
        <span className="text-subtle text-xs">{timeAgo(reply.createdAt, new Date(now))}</span>
      </div>
      <p className="text-muted mt-3 text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
      {children ? <div className="mt-3">{children}</div> : null}
      {nested ? <span className="sr-only">Nested reply</span> : null}
    </article>
  );
}

function SessionReplyButton({
  discussionId,
  parent,
}: {
  discussionId: string;
  parent: DiscussionReplyEntry;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => (session?.user ? setOpen((current) => !current) : setSignInOpen(true))}
        className="text-blue text-xs font-semibold hover:underline"
      >
        Reply
      </button>
      {open ? (
        <InlineReplyForm
          discussionId={discussionId}
          parentId={parent.id}
          onDone={() => setOpen(false)}
        />
      ) : null}
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}

function SessionReplyComposer({ discussionId }: { discussionId: string }) {
  const { data: session, isPending } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  if (isPending) return null;
  if (!session?.user) {
    return (
      <div className="border-border bg-panel mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <p className="text-muted text-sm">Sign in to respond to this discussion.</p>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="text-blue text-sm font-semibold hover:underline"
        >
          Sign in to respond
        </button>
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      </div>
    );
  }
  return <InlineReplyForm discussionId={discussionId} parentId={null} />;
}

function InlineReplyForm({
  discussionId,
  parentId,
  onDone,
}: {
  discussionId: string;
  parentId: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    clientId.current ??= createClientMutationId();
    try {
      const response = await fetch(`/api/community/discussions/${discussionId}/replies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: clientId.current, body, parentId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not publish this reply.");
      clientId.current = null;
      setBody("");
      onDone?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish this reply.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="border-border bg-panel mt-3 rounded-lg border p-3"
    >
      <label className="sr-only" htmlFor={`reply-${parentId ?? "root"}`}>
        {parentId ? "Reply" : "Response"}
      </label>
      <textarea
        id={`reply-${parentId ?? "root"}`}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          clientId.current = null;
        }}
        minLength={2}
        maxLength={5_000}
        required
        rows={parentId ? 3 : 4}
        placeholder={parentId ? "Write a reply…" : "Share an answer or add context…"}
        className="border-border bg-code text-foreground placeholder:text-subtle focus:border-blue focus:ring-blue/20 w-full resize-y rounded-md border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          {error ? (
            <p className="text-red text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Publishing…" : parentId ? "Post reply" : "Post response"}
        </button>
      </div>
    </form>
  );
}
