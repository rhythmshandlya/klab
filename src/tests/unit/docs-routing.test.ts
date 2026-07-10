import { describe, expect, it } from "vitest";

import { resolveDocsRoute } from "@/app/docs/resolve-route";

describe("resolveDocsRoute", () => {
  it("routes a Foundations mission slug to the player", () => {
    expect(resolveDocsRoute(["foundations", "what-is-kubernetes"])).toMatchObject({
      kind: "mission",
      section: "Foundations",
    });
  });

  it("routes a section root to the player", () => {
    expect(resolveDocsRoute(["foundations"])).toMatchObject({
      kind: "mission",
      section: "Foundations",
    });
  });

  it("falls back to legacy for a non-migrated lesson", () => {
    expect(resolveDocsRoute(["operations", "namespaces"]).kind).toBe("legacy");
  });

  it("mission wins even when the same slug also exists as a legacy lesson", () => {
    // Legacy Foundations lessons share slugs with migrated missions; the mission
    // match must win — that's the whole point of migrating a section.
    const route = resolveDocsRoute(["foundations", "what-is-kubernetes"]);
    expect(route.kind).toBe("mission");
  });

  it("returns not-found for an unknown slug", () => {
    expect(resolveDocsRoute(["not", "a", "real", "slug"])).toMatchObject({ kind: "not-found" });
  });
});
