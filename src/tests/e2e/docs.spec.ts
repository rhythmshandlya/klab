import { expect, test } from "@playwright/test";

/**
 * Learn E2E: open an interactive lesson, start its inline lab, and confirm the lab's
 * cluster reconciles (the Pod becomes Ready and the Service gets an endpoint).
 */
test("open a Learn lesson and run its inline lab", async ({ page }) => {
  await page.goto("/docs/debugging/readiness-probes");

  await test.step("lesson content renders", async () => {
    await expect(page.getByRole("heading", { name: "Readiness Probes", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why probes exist" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start lab" })).toBeVisible();
  });

  await test.step("start the inline lab and observe it reconcile", async () => {
    await page.getByRole("button", { name: "Start lab" }).click();
    const fileTabs = page.getByRole("tablist", { name: "Lab files" });
    await expect(fileTabs).toBeVisible();
    await expect
      .poll(() => fileTabs.evaluate((element) => getComputedStyle(element).overflowY))
      .toBe("hidden");
    // The lab boots a cluster and applies its Pod + Service; the /healthz probe passes,
    // so the Service ends up with a ready endpoint.
    await expect(page.getByText(/web-svc:/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("web-svc: 1 ready endpoint")).toBeVisible({ timeout: 120_000 });
  });
});

test("mission completion recaps stay optional so the workspace remains usable", async ({
  page,
}) => {
  const invalidSvgAttributes: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Received NaN for the `(cx|cy|r)` attribute/.test(message.text())
    ) {
      invalidSvgAttributes.push(message.text());
    }
  });

  await page.goto("/docs/foundations/what-is-kubernetes");
  await page.getByRole("button", { name: "Start mission" }).click();

  await expect(page.getByRole("dialog", { name: "Mission: What is Kubernetes?" })).toBeVisible();
  const missionFileTabs = page.getByRole("tablist", { name: "Mission files" });
  await expect
    .poll(() => missionFileTabs.evaluate((element) => getComputedStyle(element).overflowY))
    .toBe("hidden");
  await page.getByRole("button", { name: "Apply changes" }).click();

  const goalDebrief = page.getByText(
    "You declared a Pod and the cluster made it real. You did not start a container: you described one, and the control loop did the rest.",
  );
  const missionRecap = page.getByText(
    "You now have a running Pod in a cluster you will grow across Foundations.",
  );

  await expect(page.getByText("Goal met", { exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Mission complete", { exact: true })).toBeVisible();
  await expect(goalDebrief).toBeHidden();
  await expect(missionRecap).toBeHidden();

  // Success does not replace or cover the tools: learners can keep investigating.
  await expect(page.getByText("Terminal", { exact: true })).toBeVisible();
  await expect(page.getByText("Topology", { exact: true })).toBeVisible();

  await page.getByText("Goal met", { exact: true }).click();
  await expect(goalDebrief).toBeVisible();
  await page.getByText("Mission complete", { exact: true }).click();
  await expect(missionRecap).toBeVisible();

  // Companion panes hide and reveal React Flow without fitting a zero-size viewport.
  await page.getByRole("button", { name: "Minimize mission" }).click();
  await page.getByRole("tab", { name: "Terminal" }).click();
  await page.getByRole("tab", { name: "Cluster" }).click();
  await page.getByRole("button", { name: "Expand mission" }).click();
  await expect(page.getByText("Topology", { exact: true })).toBeVisible();
  expect(invalidSvgAttributes).toEqual([]);
});
