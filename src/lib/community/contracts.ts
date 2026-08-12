import { z } from "zod";

import { BRAND } from "@/config/brand";

export const discussionCategorySchema = z.enum(["general", "feature", "bug", "problem"]);
export type DiscussionCategory = z.infer<typeof discussionCategorySchema>;

export const discussionStatusSchema = z.enum([
  "open",
  "under-review",
  "planned",
  "resolved",
  "closed",
]);
export type DiscussionStatus = z.infer<typeof discussionStatusSchema>;

export const createDiscussionSchema = z.object({
  clientId: z.string().trim().min(8).max(128),
  title: z.string().trim().min(6).max(120),
  body: z.string().trim().min(12).max(10_000),
  category: discussionCategorySchema,
});
export type CreateDiscussionInput = z.infer<typeof createDiscussionSchema>;

export const createDiscussionReplySchema = z.object({
  clientId: z.string().trim().min(8).max(128),
  body: z.string().trim().min(2).max(5_000),
  parentId: z.uuid().nullable().default(null),
});
export type CreateDiscussionReplyInput = z.infer<typeof createDiscussionReplySchema>;

export const moderateDiscussionSchema = z
  .object({
    status: discussionStatusSchema.optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.pinned !== undefined, {
    message: "Provide a status or pinned value.",
  });
export type ModerateDiscussionInput = z.infer<typeof moderateDiscussionSchema>;

export const DISCUSSION_CATEGORIES: ReadonlyArray<{
  value: DiscussionCategory;
  label: string;
  description: string;
}> = [
  { value: "general", label: "General", description: "Questions and Kubernetes conversation" },
  {
    value: "feature",
    label: "Feature request",
    description: `Ideas for improving ${BRAND.name}`,
  },
  {
    value: "bug",
    label: "Bug report",
    description: `Something in ${BRAND.name} is not working`,
  },
  { value: "problem", label: "Problem idea", description: "Suggest a future debugging problem" },
];

export function discussionCategoryLabel(category: DiscussionCategory): string {
  return DISCUSSION_CATEGORIES.find((candidate) => candidate.value === category)?.label ?? category;
}

export function discussionStatusLabel(status: DiscussionStatus): string {
  return status.replace("-", " ");
}

export function discussionSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "discussion"
  );
}

export function discussionPath(discussion: { id: string; title: string }): string {
  return `/community/discussions/${discussion.id}/${discussionSlug(discussion.title)}`;
}
