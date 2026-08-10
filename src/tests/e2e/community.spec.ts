import { expect, test } from "@playwright/test";

test("community offers useful actions even before activity exists", async ({ page }) => {
  await page.goto("/community");

  await expect(page.getByRole("heading", { name: "Learn Kubernetes together" })).toBeVisible();
  await expect(page.getByText("Weekly challenge", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community Playgrounds" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Take this week's challenge/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Build your own" })).toBeVisible();

  await expect(page.getByText("Quiet in here")).toHaveCount(0);
  await expect(page.getByText("No records yet")).toHaveCount(0);
});
