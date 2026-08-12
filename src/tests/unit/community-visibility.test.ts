import { describe, expect, it } from "vitest";

import {
  COMMUNITY_COMPETITION_MIN_PLAYERS,
  isCommunityCompetitionReady,
} from "@/features/community/visibility";

describe("Community progressive disclosure", () => {
  it("keeps competitive side rails hidden until three distinct players participate", () => {
    expect(COMMUNITY_COMPETITION_MIN_PLAYERS).toBe(3);
    expect(isCommunityCompetitionReady([])).toBe(false);
    expect(isCommunityCompetitionReady([{ userId: "one" }, { userId: "two" }])).toBe(false);
    expect(
      isCommunityCompetitionReady([{ userId: "one" }, { userId: "two" }, { userId: "three" }]),
    ).toBe(true);
  });

  it("counts people rather than duplicate rows", () => {
    expect(
      isCommunityCompetitionReady([{ userId: "one" }, { userId: "one" }, { userId: "two" }]),
    ).toBe(false);
  });
});
