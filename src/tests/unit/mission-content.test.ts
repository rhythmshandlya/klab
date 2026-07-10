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
  it("has exactly six Foundations missions ordered 1..6", () => {
    const f = getMissionsBySection("Foundations");
    expect(f).toHaveLength(6);
    expect(f.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("grows a persistent cluster: only mission 1 seeds, missions 2-6 inherit it", () => {
    const f = getMissionsBySection("Foundations");
    expect(f.map((m) => m.inheritsCluster)).toEqual([false, true, true, true, true, true]);
  });
  it("each Foundations mission advances the cluster with at least one do step", () => {
    for (const m of getMissionsBySection("Foundations")) {
      expect(m.steps.some((s) => s.kind === "do")).toBe(true);
      expect(m.steps.at(-1)?.kind).toBe("debrief");
    }
  });
});
