"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { icons } from "@/components/icons";
import {
  discussionStatusLabel,
  discussionStatusSchema,
  type DiscussionStatus,
} from "@/lib/community/contracts";
import { useSession } from "@/lib/auth/client";

export function DiscussionModeration({
  discussionId,
  status,
  pinned,
  authEnabled,
}: {
  discussionId: string;
  status: DiscussionStatus;
  pinned: boolean;
  authEnabled: boolean;
}) {
  if (!authEnabled) return null;
  return <SessionModeration discussionId={discussionId} status={status} pinned={pinned} />;
}

function SessionModeration({
  discussionId,
  status,
  pinned,
}: {
  discussionId: string;
  status: DiscussionStatus;
  pinned: boolean;
}) {
  const { data: session } = useSession();
  const currentUser = session?.user as { isOfficial?: boolean } | undefined;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!currentUser?.isOfficial) return null;

  const update = async (patch: { status?: DiscussionStatus; pinned?: boolean }) => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/community/discussions/${discussionId}/moderate`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not update this discussion.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this discussion.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border-blue/25 bg-blue/[0.05] mt-4 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-blue text-[10px] font-semibold tracking-[0.08em] uppercase">
          KLab Team controls
        </span>
        <select
          value={status}
          onChange={(event) =>
            void update({ status: discussionStatusSchema.parse(event.target.value) })
          }
          disabled={pending}
          aria-label="Discussion status"
          className="border-border bg-panel text-foreground h-8 rounded-md border px-2 text-xs"
        >
          {discussionStatusSchema.options.map((option) => (
            <option key={option} value={option}>
              {discussionStatusLabel(option)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void update({ pinned: !pinned })}
          disabled={pending}
          className="border-border bg-panel text-foreground hover:bg-panel-hover inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium disabled:opacity-50"
        >
          <icons.pin className="size-3.5" aria-hidden />
          {pinned ? "Unpin" : "Pin"}
        </button>
      </div>
      {error ? <p className="text-red mt-2 text-xs">{error}</p> : null}
    </div>
  );
}
