import { describe, expect, it } from "vitest";

import { createClientMutationId, parseIntents } from "@/lib/storage/progress-intent";

describe("progress intent validation", () => {
  it("creates unique submission IDs that survive strict parsing", () => {
    const first = createClientMutationId();
    const second = createClientMutationId();

    expect(first).not.toBe(second);
    expect(
      parseIntents({
        intents: [
          {
            kind: "submission",
            slug: "broken-readiness-probe",
            passed: true,
            checksTotal: 5,
            checksPassed: 5,
            durationMs: 12_000,
            clientMutationId: first,
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it("rejects submissions without an id or with impossible check counts", () => {
    expect(() =>
      parseIntents({
        intents: [
          {
            kind: "submission",
            slug: "broken-readiness-probe",
            passed: true,
            checksTotal: 3,
            checksPassed: 4,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects invalid solved dates", () => {
    expect(() =>
      parseIntents({
        intents: [
          {
            kind: "solved",
            slug: "broken-readiness-probe",
            xp: 100,
            day: "2026-02-31",
          },
        ],
      }),
    ).toThrow();
  });
});
