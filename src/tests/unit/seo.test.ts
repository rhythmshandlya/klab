import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { absoluteUrl, serializeJsonLd, SITE_ORIGIN } from "@/lib/seo";

describe("community SEO foundations", () => {
  it("publishes absolute canonical URLs on the production origin", () => {
    expect(absoluteUrl("/community")).toBe(`${SITE_ORIGIN}/community`);
  });

  it("escapes authored markup before embedding JSON-LD", () => {
    expect(serializeJsonLd({ body: "</script><script>alert(1)</script>" })).not.toContain("<");
  });

  it("advertises the sitemap and keeps public Community routes crawlable", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
    expect(result.rules).toMatchObject({ allow: ["/", "/community/"] });
  });
});
