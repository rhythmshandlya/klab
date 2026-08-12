import { describe, expect, it } from "vitest";

import {
  homeEntryDestination,
  isProductPath,
  PRODUCT_HOME,
  safeEntryDestination,
} from "@/lib/auth/entry";

describe("product entry flow", () => {
  it("recognizes every product surface without treating lookalike paths as product routes", () => {
    for (const path of [
      "/problems",
      "/problems/readiness",
      "/playground",
      "/docs/foundations",
      "/community/discussions",
      "/account",
    ]) {
      expect(isProductPath(path)).toBe(true);
    }
    expect(isProductPath("/problematic")).toBe(false);
    expect(isProductPath("/reset-password")).toBe(false);
  });

  it("keeps internal deep links and rejects external or non-product destinations", () => {
    expect(safeEntryDestination("/community/discussions?category=bug")).toBe(
      "/community/discussions?category=bug",
    );
    expect(safeEntryDestination("https://example.com/problems")).toBe(PRODUCT_HOME);
    expect(safeEntryDestination("//example.com/problems")).toBe(PRODUCT_HOME);
    expect(safeEntryDestination("/reset-password")).toBe(PRODUCT_HOME);
  });

  it("bypasses the landing page only after a session or explicit guest choice", () => {
    const requestedDestination = "/playground";
    expect(
      homeEntryDestination({
        hasSession: false,
        hasGuestEntry: false,
        requestedDestination,
      }),
    ).toBeNull();
    expect(
      homeEntryDestination({
        hasSession: true,
        hasGuestEntry: false,
        requestedDestination,
      }),
    ).toBe(requestedDestination);
    expect(
      homeEntryDestination({
        hasSession: false,
        hasGuestEntry: true,
        requestedDestination,
      }),
    ).toBe(requestedDestination);
  });
});
