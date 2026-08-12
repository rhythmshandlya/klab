import { expect, test } from "@playwright/test";

import { BRAND } from "@/config/brand";

test("architecture builds present an honest static design workflow", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) =>
    runtimeErrors.push(`${error.name}: ${error.message}\n${error.stack}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  await page.goto("/problems/build-three-zone-api");
  await page.waitForTimeout(2_000);
  expect(runtimeErrors).toEqual([]);

  await expect(page.getByRole("heading", { name: "Build a Three-Zone API" })).toBeVisible();
  await expect(page.getByText("Architecture Brief", { exact: true })).toBeVisible();
  await expect(page.getByText("Static architecture review", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(
      `${BRAND.name} checks submitted manifests, required fields, and resource relationships. It does not provision a real cluster or prove the stated SLO and failure scenarios.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Static Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Static Review" })).toBeVisible();
  await expect(page.getByText("Design Inventory", { exact: true })).toBeVisible();
  await expect(page.getByText("Static Review Runtime", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deploy Design" })).toHaveCount(0);

  await expect(page.getByText("Scenario ready", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Submit Static Review" }).click();
  await expect(page.getByText("Design needs revision", { exact: true })).toBeVisible();
});

test("new repair levels expose real-cluster investigation runbooks", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) =>
    runtimeErrors.push(`${error.name}: ${error.message}\n${error.stack}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  await page.goto("/problems/local-traffic-black-hole");
  await page.waitForTimeout(2_000);
  expect(runtimeErrors).toEqual([]);

  await expect(page.getByRole("heading", { name: "Local Traffic Black Hole" })).toBeVisible();
  await expect(page.getByText("Incident Brief", { exact: true })).toBeVisible();
  await expect(page.getByText("Static repair review", { exact: true })).toBeVisible();
  await expect(page.getByText("Production runbook", { exact: true })).toBeVisible();
  await expect(
    page.getByText("kubectl get service payments-public -n payments -o yaml", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply Changes" })).toBeVisible();
});

test("the capstone signed-promotion architecture challenge renders cleanly", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) =>
    runtimeErrors.push(`${error.name}: ${error.message}\n${error.stack}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/problems/build-signed-promotion-pipeline");
  await expect(
    page.getByRole("heading", { name: "Build a Signed Promotion Pipeline" }),
  ).toBeVisible();
  await expect(page.getByText("Design Inventory", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Static Review" })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "break-glass-ticket-policy.yaml", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(runtimeErrors).toEqual([]);
});
