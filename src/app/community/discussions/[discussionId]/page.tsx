import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { z } from "zod";

import {
  communityDiscussionMetadata,
  loadCommunityDiscussion,
} from "@/features/community/discussion-detail";
import { discussionPath } from "@/lib/community/contracts";

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ discussionId: string }>;
}): Promise<Metadata> {
  const discussionId = z.uuid().safeParse((await params).discussionId);
  return communityDiscussionMetadata(
    discussionId.success ? await loadCommunityDiscussion(discussionId.data) : null,
  );
}

export default async function LegacyDiscussionPage({
  params,
}: {
  params: Promise<{ discussionId: string }>;
}) {
  const discussionId = z.uuid().safeParse((await params).discussionId);
  if (!discussionId.success) notFound();
  const thread = await loadCommunityDiscussion(discussionId.data);
  if (!thread) notFound();
  permanentRedirect(discussionPath(thread.discussion));
}
