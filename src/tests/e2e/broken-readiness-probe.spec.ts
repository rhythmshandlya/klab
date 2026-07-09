import { expect, test } from "@playwright/test";

/**
 * Full happy-path E2E for the reference level, per PROMPT.md: boot a real in-browser
 * Kubernetes cluster, investigate via the terminal, read the evidence, edit the
 * manifest to fix the readiness probe, apply, run validation, and see success.
 */
test("solve the Broken Readiness Probe incident end-to-end", async ({ page }) => {
  await page.goto("/problems/broken-readiness-probe");

  await test.step("cluster boots", async () => {
    await expect(page.getByText("Simulator ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
  });

  await test.step("investigate with the terminal and collect evidence", async () => {
    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    // Re-run `get pods` until the pod is Running and the evidence is collected (the
    // pod takes a moment to schedule + start after boot).
    await expect(async () => {
      await page.keyboard.type("kubectl get pods");
      await page.keyboard.press("Enter");
      await expect(page.getByText("Pod is Running", { exact: true })).toBeVisible({
        timeout: 4_000,
      });
    }).toPass({ timeout: 30_000 });
    await expect(page.locator(".xterm")).toContainText("web-app");
  });

  await test.step("validation fails before the fix", async () => {
    // The nav hosts the single Run Validation button; its accessible name includes
    // the ⌘R shortcut, so match by substring.
    await page.getByRole("button", { name: "Run Validation" }).click();
    await expect(page.getByText("Not passing yet")).toBeVisible();
    await page.getByRole("button", { name: "Keep investigating" }).click();
  });

  await test.step("fix the readiness probe path in the editor", async () => {
    await page.locator(".monaco-editor").first().waitFor({ state: "visible", timeout: 30_000 });
    // Select "/readyz" in the editor, then type "/healthz" over it — a real UI edit.
    const selected = await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      const model = editor?.getModel?.();
      if (!editor || !model) return false;
      const matches = model.findMatches("/readyz", false, false, false, null, false);
      if (matches.length === 0) return false;
      editor.focus();
      editor.setSelection(matches[0]!.range);
      editor.revealRangeInCenter(matches[0]!.range);
      return true;
    });
    expect(selected).toBe(true);
    await page.keyboard.type("/healthz");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const monaco = (window as any).monaco;
          const value = monaco.editor.getEditors()[0]?.getModel()?.getValue() ?? "";
          return value.includes("/healthz") && !value.includes("/readyz");
        }),
      )
      .toBe(true);
  });

  await test.step("apply the fix and validate until resolved", async () => {
    await page.getByRole("button", { name: "Apply Changes" }).click();

    await expect(async () => {
      const close = page.getByRole("button", { name: "Keep investigating" });
      if (await close.isVisible().catch(() => false)) await close.click();
      await page.getByRole("button", { name: "Run Validation" }).click();
      await expect(page.getByText("Incident resolved")).toBeVisible({ timeout: 6_000 });
    }).toPass({ timeout: 90_000 });

    // Post-solve teaching is shown.
    await expect(page.getByText("Root cause")).toBeVisible();
  });
});
