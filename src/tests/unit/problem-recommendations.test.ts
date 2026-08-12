import { describe, expect, it } from "vitest";

import type { LevelSummary } from "@/content/levels";
import {
  pickDailyChallenge,
  recommendProblems,
} from "@/features/problems/components/problems-dashboard";

function level(
  overrides: Partial<LevelSummary> & Pick<LevelSummary, "slug" | "title">,
): LevelSummary {
  return {
    difficulty: "beginner",
    severity: "medium",
    xp: 100,
    estimatedMinutes: 15,
    successRate: 70,
    statsSource: "authored-estimate",
    challengeMode: "repair",
    concepts: ["pods"],
    learningObjectives: [],
    prerequisites: [],
    learningPaths: ["kubernetes-foundations"],
    capabilities: [],
    kubernetesVersion: { min: "1.34", max: "1.36", tested: "1.36" },
    blurb: "A test problem",
    ...overrides,
  };
}

const CATALOG: LevelSummary[] = [
  level({ slug: "pods-first", title: "Pods First" }),
  level({
    slug: "deployment-next",
    title: "Deployment Next",
    difficulty: "intermediate",
    concepts: ["pods", "deployments"],
    prerequisites: ["pods-first"],
  }),
  level({
    slug: "dns-detour",
    title: "DNS Detour",
    concepts: ["dns"],
    learningPaths: ["networking"],
  }),
];

describe("Problems dashboard recommendations", () => {
  it("keeps the daily pick stable while avoiding solved and active problems", () => {
    const solved = new Set(["pods-first"]);
    const attempted = new Set(["deployment-next"]);

    const first = pickDailyChallenge(CATALOG, solved, attempted, "2026-08-11");
    const second = pickDailyChallenge(CATALOG, solved, attempted, "2026-08-11");

    expect(first?.slug).toBe("dns-detour");
    expect(second?.slug).toBe(first?.slug);
  });

  it("ranks unlocked problems that build on practiced concepts ahead of detours", () => {
    const recommendations = recommendProblems(
      CATALOG,
      new Set(["pods-first"]),
      new Set(),
      new Set(),
    );

    expect(recommendations[0]?.slug).toBe("deployment-next");
    expect(recommendations.map((entry) => entry.slug)).not.toContain("pods-first");
  });

  it("never recommends a problem whose prerequisites are still locked", () => {
    const recommendations = recommendProblems(
      CATALOG,
      new Set(),
      new Set(),
      new Set(["deployment-next"]),
    );

    expect(recommendations.map((entry) => entry.slug)).not.toContain("deployment-next");
    expect(pickDailyChallenge(CATALOG, new Set(), new Set(), "2026-08-11")?.slug).not.toBe(
      "deployment-next",
    );
  });
});
