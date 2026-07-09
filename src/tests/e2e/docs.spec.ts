import { expect, test } from "@playwright/test";

/**
 * Docs E2E: open an interactive lesson, start its inline lab, and confirm the lab's
 * cluster reconciles (the Pod becomes Ready and the Service gets an endpoint).
 */
test("open a docs lesson and run its inline lab", async ({ page }) => {
  await page.goto("/docs/debugging/readiness-probes");

  await test.step("lesson content renders", async () => {
    await expect(page.getByRole("heading", { name: "Readiness Probes", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Readiness vs liveness" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
  });

  await test.step("start the inline lab and observe it reconcile", async () => {
    await page.getByRole("button", { name: "Start lab" }).click();
    // The lab boots a cluster and applies its Pod + Service; the /healthz probe passes,
    // so the Service ends up with a ready endpoint.
    await expect(page.getByText(/web-svc:/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("web-svc: 1 ready endpoint")).toBeVisible({ timeout: 120_000 });
  });
});
