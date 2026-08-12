import { describe, expect, it } from "vitest";

import {
  createDiscussionReplySchema,
  createDiscussionSchema,
  discussionPath,
  discussionSlug,
  moderateDiscussionSchema,
} from "@/lib/community/contracts";

describe("community discussion contracts", () => {
  it("accepts every supported discussion category and trims authored content", () => {
    for (const category of ["general", "feature", "bug", "problem"] as const) {
      expect(
        createDiscussionSchema.parse({
          clientId: " mutation-0001 ",
          title: " A useful topic ",
          body: " Enough detail to begin a useful conversation. ",
          category,
        }),
      ).toEqual({
        clientId: "mutation-0001",
        title: "A useful topic",
        body: "Enough detail to begin a useful conversation.",
        category,
      });
    }
  });

  it("rejects underspecified discussions and unsupported categories", () => {
    expect(
      createDiscussionSchema.safeParse({
        clientId: "short",
        title: "Bug",
        body: "No detail",
        category: "support",
      }).success,
    ).toBe(false);
  });

  it("defaults replies to the root and validates nested reply ids", () => {
    expect(createDiscussionReplySchema.parse({ clientId: "reply-0001", body: "Thanks" })).toEqual({
      clientId: "reply-0001",
      body: "Thanks",
      parentId: null,
    });
    expect(
      createDiscussionReplySchema.safeParse({
        clientId: "reply-0002",
        body: "Thanks",
        parentId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("requires at least one server moderation change", () => {
    expect(moderateDiscussionSchema.safeParse({}).success).toBe(false);
    expect(moderateDiscussionSchema.parse({ status: "planned", pinned: true })).toEqual({
      status: "planned",
      pinned: true,
    });
  });

  it("builds stable, descriptive discussion URLs", () => {
    expect(discussionSlug("Why isn't my Service finding Pods?")).toBe(
      "why-isn-t-my-service-finding-pods",
    );
    expect(
      discussionPath({
        id: "123e4567-e89b-42d3-a456-426614174000",
        title: "Debugging a broken readiness probe",
      }),
    ).toBe(
      "/community/discussions/123e4567-e89b-42d3-a456-426614174000/debugging-a-broken-readiness-probe",
    );
  });
});
