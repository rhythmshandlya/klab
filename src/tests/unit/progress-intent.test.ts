import { describe, expect, it } from "vitest";

import { EMPTY_PROGRESS } from "@/lib/storage/local-progress";
import {
  applyIntent,
  createClientMutationId,
  parseIntents,
  parseProgressBatch,
} from "@/lib/storage/progress-intent";

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

  it("rejects a delivery whose immutable owner differs from its batch", () => {
    expect(() =>
      parseProgressBatch({
        ownerId: "user-B",
        deliveries: [
          {
            id: "delivery-00000001",
            ownerId: "user-A",
            createdAt: 1,
            intent: { kind: "attempted", slug: "broken-readiness-probe" },
          },
        ],
      }),
    ).toThrow();
  });

  it("replays the captured solve day instead of the retry day's clock", () => {
    const progress = applyIntent(EMPTY_PROGRESS, {
      kind: "solved",
      slug: "broken-readiness-probe",
      xp: 100,
      day: "2026-07-08",
    });

    expect(progress.lastSolvedDay).toBe("2026-07-08");
  });
});
