import { expect, test } from "@playwright/test";

/**
 * Playground apply → observe E2E: open the Deployment + Service template, confirm its
 * pods appear, then add a Pod via the object shortcut, Apply, and observe it appear.
 * Asserts on stable facts (workload names in `kubectl get pods`) rather than the
 * ready-count, which reports with some lag in-browser. (Monaco text-editing → apply
 * is separately covered by the Problems E2E.)
 */
test("apply a manifest in the playground and observe the new pod", async ({ page }) => {
  await page.goto("/playground/deployment-service");

  await test.step("sandbox boots and the template's pods appear", async () => {
    await expect(page.getByText("Simulator ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    await expect(async () => {
      await page.keyboard.type("kubectl get pods");
      await page.keyboard.press("Enter");
      await expect(page.locator(".xterm")).toContainText("webapp", { timeout: 4_000 });
    }).toPass({ timeout: 30_000 });
  });

  await test.step("add a Pod via the shortcut, apply, and observe it", async () => {
    await page.getByRole("button", { name: "+ Pod" }).click();
    await page.getByRole("button", { name: "Apply Manifests" }).click();

    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    await expect(async () => {
      await page.keyboard.type("kubectl get pods");
      await page.keyboard.press("Enter");
      await expect(page.locator(".xterm")).toContainText("my-pod", { timeout: 4_000 });
    }).toPass({ timeout: 45_000 });
  });
});
