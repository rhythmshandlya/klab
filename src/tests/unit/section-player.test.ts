import { describe, expect, it } from "vitest";

import { initialMissionIndex } from "@/features/docs/mission/section-player";
import { getMissionsBySection } from "@/content/missions";

describe("initialMissionIndex", () => {
  const missions = getMissionsBySection("Foundations");

  it("defaults to 0 when no slug", () => {
    expect(initialMissionIndex(missions, undefined)).toBe(0);
  });

  it("finds the mission matching a deep-link slug", () => {
    expect(initialMissionIndex(missions, ["foundations", "what-is-kubernetes"])).toBe(0);
  });

  it("finds a later mission in the section by its slug", () => {
    expect(initialMissionIndex(missions, ["foundations", "cluster-architecture"])).toBe(1);
  });

  it("falls back to 0 for a slug outside the section", () => {
    expect(initialMissionIndex(missions, ["operations", "namespaces"])).toBe(0);
  });
});
