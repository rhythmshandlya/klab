import { describe, expect, it } from "vitest";
import { MISSIONS, getMissionBySlug, getMissionsBySection } from "@/content/missions";

describe("mission content", () => {
  it("registers Foundations missions in order", () => {
    const f = getMissionsBySection("Foundations");
    expect(f.length).toBeGreaterThanOrEqual(1);
    expect(f.map((m) => m.order)).toEqual([...f.map((m) => m.order)].sort((a, b) => a - b));
  });
  it("resolves a mission by slug", () => {
    expect(getMissionBySlug(["foundations", "what-is-kubernetes"])?.title).toBe("What is Kubernetes?");
  });
  it("every mission's first section mission does not inherit and has seedManifests", () => {
    for (const section of ["Foundations"]) {
      const first = getMissionsBySection(section)[0];
      if (first) {
        expect(first.inheritsCluster).toBe(false);
        expect(first.seedManifests).toBeDefined();
      }
    }
  });
  it("every step has an action-bearing kind", () => {
    const kinds = new Set(["teach", "predict", "check", "do", "debrief"]);
    for (const m of MISSIONS) for (const s of m.steps) expect(kinds.has(s.kind)).toBe(true);
  });
});
