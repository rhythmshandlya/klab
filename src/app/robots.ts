import type { MetadataRoute } from "next";

import { absoluteUrl, SITE_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/community/"],
      disallow: ["/account", "/api/"],
    },
    host: SITE_ORIGIN,
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
