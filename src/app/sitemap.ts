import type { MetadataRoute } from "next";

import { discussionPath } from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import { readDiscussions } from "@/lib/db/discussions-repo";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: absoluteUrl("/community"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
  if (!hasDb()) return staticEntries;

  try {
    const discussions = await readDiscussions(getDb(), { limit: 500 });
    return [
      ...staticEntries,
      ...discussions.map((discussion) => ({
        url: absoluteUrl(discussionPath(discussion)),
        lastModified: new Date(discussion.updatedAt),
        changeFrequency: "weekly" as const,
        priority: discussion.pinned ? 0.8 : 0.7,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
