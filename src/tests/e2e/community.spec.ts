import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("community is a public, interaction-first surface", async ({ page }) => {
  await page.goto("/community");

  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByRole("heading", { name: "Kubernetes discussions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New discussion" }).first()).toBeVisible();

  await expect(page.getByText("Learn Kubernetes together", { exact: true })).toHaveCount(0);
  await expect(page.getByText("The community library is getting started")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Weekly leaderboard" })).toHaveCount(0);

  await expect(page).toHaveTitle(/Kubernetes Community Discussions/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://klab-five.vercel.app/community",
  );
  const structuredData = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
  ) as { "@type"?: string };
  expect(structuredData["@type"]).toBe("CollectionPage");
});

test("discussion channel exposes clear contribution categories", async ({ page }) => {
  await page.goto("/community/discussions");

  await expect(page).toHaveURL(/\/community$/);
  await expect(
    page.getByRole("heading", { name: "Kubernetes discussions", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("compare debugging approaches", { exact: false })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Discussion categories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "All", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const category of ["General", "Feature request", "Bug report", "Problem idea"]) {
    await expect(page.getByRole("link", { name: category, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "New discussion" }).first()).toBeVisible();
});
