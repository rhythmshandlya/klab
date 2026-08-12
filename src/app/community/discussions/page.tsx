import { permanentRedirect } from "next/navigation";

import { discussionCategorySchema } from "@/lib/community/contracts";

export default async function DiscussionsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const category = discussionCategorySchema.safeParse((await searchParams).category);
  permanentRedirect(category.success ? `/community?category=${category.data}` : "/community");
}
