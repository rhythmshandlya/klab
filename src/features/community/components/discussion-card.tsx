import Link from "next/link";

import { icons } from "@/components/icons";
import {
  discussionCategoryLabel,
  discussionStatusLabel,
  type DiscussionCategory,
  type DiscussionStatus,
  discussionPath,
} from "@/lib/community/contracts";
import type { DiscussionAuthor, DiscussionEntry } from "@/lib/db/discussions-repo";
import { cn } from "@/lib/utils/cn";

import { timeAgo } from "../format";
import { PersonAvatar } from "./person";

const CATEGORY_STYLES: Record<DiscussionCategory, string> = {
  general: "border-blue/25 bg-blue/10 text-blue",
  feature: "border-purple/25 bg-purple/10 text-purple",
  bug: "border-red/25 bg-red/10 text-red",
  problem: "border-amber/25 bg-amber/10 text-amber",
};

const STATUS_STYLES: Record<DiscussionStatus, string> = {
  open: "border-border bg-panel-elevated text-muted",
  "under-review": "border-blue/25 bg-blue/10 text-blue",
  planned: "border-purple/25 bg-purple/10 text-purple",
  resolved: "border-green/25 bg-green/10 text-green",
  closed: "border-border bg-panel-elevated text-subtle",
};

export function DiscussionCard({
  discussion,
  now,
  compact = false,
}: {
  discussion: DiscussionEntry;
  now: Date;
  compact?: boolean;
}) {
  const Message = icons.discussion;
  const Pin = icons.pin;
  return (
    <article className="border-border bg-panel hover:border-border-strong rounded-xl border p-4 transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {discussion.pinned ? (
              <span className="text-amber inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
                <Pin className="size-3" aria-hidden />
                Pinned
              </span>
            ) : null}
            <DiscussionCategoryBadge category={discussion.category} />
            {discussion.status !== "open" ? (
              <DiscussionStatusBadge status={discussion.status} />
            ) : null}
          </div>
          <Link
            href={discussionPath(discussion)}
            className="text-foreground mt-2 block text-[15px] leading-snug font-semibold hover:underline"
          >
            {discussion.title}
          </Link>
          <p
            className={cn(
              "text-muted mt-1.5 text-sm leading-relaxed whitespace-pre-line",
              compact ? "line-clamp-2" : "line-clamp-3",
            )}
          >
            {discussion.body}
          </p>
        </div>
        <span className="text-subtle flex shrink-0 items-center gap-1 text-xs">
          <Message className="size-3.5" aria-hidden />
          {discussion.replyCount}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DiscussionAuthorLine author={discussion.author} />
        <div className="flex items-center gap-3">
          <span className="text-subtle shrink-0 text-xs">
            active {timeAgo(discussion.lastActivityAt, now)}
          </span>
          <Link
            href={discussionPath(discussion)}
            className="text-blue shrink-0 text-xs font-semibold hover:underline"
          >
            Read &amp; reply
          </Link>
        </div>
      </div>
    </article>
  );
}

export function DiscussionAuthorLine({ author }: { author: DiscussionAuthor }) {
  const displayName = author.isOfficial ? "KLab Team" : author.isAnonymous ? "Guest" : author.name;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <PersonAvatar
        name={displayName}
        image={author.image}
        isAnonymous={author.isAnonymous}
        className="size-6 text-[9px]"
      />
      <span className="text-muted truncate text-xs font-medium">{displayName}</span>
      {author.isOfficial ? (
        <span className="border-blue/30 bg-blue/10 text-blue shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.06em] uppercase">
          Official
        </span>
      ) : null}
    </div>
  );
}

export function DiscussionCategoryBadge({ category }: { category: DiscussionCategory }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        CATEGORY_STYLES[category],
      )}
    >
      {discussionCategoryLabel(category)}
    </span>
  );
}

export function DiscussionStatusBadge({ status }: { status: DiscussionStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
        STATUS_STYLES[status],
      )}
    >
      {discussionStatusLabel(status)}
    </span>
  );
}
