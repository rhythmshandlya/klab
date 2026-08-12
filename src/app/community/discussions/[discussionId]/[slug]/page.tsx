import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { z } from "zod";

import {
  CommunityDiscussionDetail,
  communityDiscussionMetadata,
  loadCommunityDiscussion,
} from "@/features/community/discussion-detail";
import { discussionPath, discussionSlug } from "@/lib/community/contracts";

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ discussionId: string; slug: string }>;
}): Promise<Metadata> {
  const discussionId = z.uuid().safeParse((await params).discussionId);
  return communityDiscussionMetadata(
    discussionId.success ? await loadCommunityDiscussion(discussionId.data) : null,
  );
}

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ discussionId: string; slug: string }>;
}) {
  const resolved = await params;
  const discussionId = z.uuid().safeParse(resolved.discussionId);
  if (!discussionId.success) notFound();
  const thread = await loadCommunityDiscussion(discussionId.data);
  if (!thread) notFound();
  if (resolved.slug !== discussionSlug(thread.discussion.title)) {
    permanentRedirect(discussionPath(thread.discussion));
  }
  return <CommunityDiscussionDetail thread={thread} />;
}
