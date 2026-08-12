import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { icons } from "@/components/icons";
import {
  DiscussionAuthorLine,
  DiscussionCategoryBadge,
  DiscussionStatusBadge,
} from "@/features/community/components/discussion-card";
import { DiscussionModeration } from "@/features/community/components/discussion-moderation";
import { DiscussionReplies } from "@/features/community/components/discussion-replies";
import { timeAgo } from "@/features/community/format";
import { discussionPath } from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import { readDiscussion, type DiscussionThread } from "@/lib/db/discussions-repo";
import { isAuthConfigured } from "@/lib/env";
import { absoluteUrl, serializeJsonLd } from "@/lib/seo";

export const loadCommunityDiscussion = cache(
  async (discussionId: string): Promise<DiscussionThread | null> => {
    if (!hasDb()) return null;
    return readDiscussion(getDb(), discussionId).catch(() => null);
  },
);

export function communityDiscussionMetadata(thread: DiscussionThread | null): Metadata {
  if (!thread) return { title: "Kubernetes community discussion" };
  const { discussion } = thread;
  const description = discussion.body.replace(/\s+/g, " ").trim().slice(0, 158);
  const canonical = discussionPath(discussion);
  return {
    title: discussion.title,
    description,
    keywords: [
      "Kubernetes community",
      "Kubernetes questions",
      "Kubernetes troubleshooting",
      discussion.category,
    ],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonical,
      title: discussion.title,
      description,
      publishedTime: discussion.createdAt,
      modifiedTime: discussion.updatedAt,
      authors: [discussion.author.isOfficial ? "KLab Team" : discussion.author.name],
    },
    twitter: { card: "summary", title: discussion.title, description },
  };
}

export function CommunityDiscussionDetail({ thread }: { thread: DiscussionThread }) {
  const { discussion, replies } = thread;
  const authEnabled = isAuthConfigured();
  const now = new Date();
  const canonical = discussionPath(discussion);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: discussion.title,
    articleBody: discussion.body,
    url: absoluteUrl(canonical),
    datePublished: discussion.createdAt,
    dateModified: discussion.updatedAt,
    author: schemaAuthor(discussion.author),
    publisher: { "@type": "Organization", name: "KLab", url: absoluteUrl("/") },
    commentCount: replies.length,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: replies.length,
    },
    comment: replies.map((reply) => ({
      "@type": "Comment",
      text: reply.body,
      dateCreated: reply.createdAt,
      author: schemaAuthor(reply.author),
    })),
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Link
        href="/community"
        className="text-subtle hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
      >
        <icons.chevronLeft className="size-3.5" aria-hidden />
        All discussions
      </Link>

      <article className="border-border bg-panel mt-5 rounded-xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {discussion.pinned ? (
            <span className="text-amber inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
              <icons.pin className="size-3" aria-hidden />
              Pinned
            </span>
          ) : null}
          <DiscussionCategoryBadge category={discussion.category} />
          <DiscussionStatusBadge status={discussion.status} />
        </div>
        <h1 className="text-foreground mt-3 text-2xl leading-tight font-semibold tracking-tight">
          {discussion.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <DiscussionAuthorLine author={discussion.author} />
          <span className="text-subtle text-xs">posted {timeAgo(discussion.createdAt, now)}</span>
        </div>
        <div className="border-border text-muted mt-5 border-t pt-5 text-sm leading-7 whitespace-pre-wrap">
          {discussion.body}
        </div>
        <DiscussionModeration
          discussionId={discussion.id}
          status={discussion.status}
          pinned={discussion.pinned}
          authEnabled={authEnabled}
        />
      </article>

      <DiscussionReplies
        discussionId={discussion.id}
        replies={replies}
        status={discussion.status}
        authEnabled={authEnabled}
        now={now.toISOString()}
      />
    </div>
  );
}

function schemaAuthor(author: DiscussionThread["discussion"]["author"]) {
  if (author.isOfficial) {
    return { "@type": "Organization", name: "KLab Team", url: absoluteUrl("/community") };
  }
  return {
    "@type": "Person",
    name: author.isAnonymous ? "KLab community member" : author.name,
  };
}
