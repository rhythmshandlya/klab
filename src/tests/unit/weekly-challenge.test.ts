import { describe, expect, it } from "vitest";

import { getWeeklyChallenge } from "@/features/community/weekly-challenge";

describe("weekly community challenge", () => {
  it("uses a stable UTC Monday window for the full week", () => {
    const monday = getWeeklyChallenge(new Date("2026-08-10T00:01:00Z"));
    const sunday = getWeeklyChallenge(new Date("2026-08-16T23:59:00Z"));

    expect(monday.level.slug).toBe(sunday.level.slug);
    expect(monday.startsAt.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(monday.endsAt.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("rotates to a different catalog problem the following week", () => {
    const current = getWeeklyChallenge(new Date("2026-08-10T12:00:00Z"));
    const following = getWeeklyChallenge(new Date("2026-08-17T12:00:00Z"));
    expect(following.level.slug).not.toBe(current.level.slug);
  });
});
