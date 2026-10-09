import { expect, test, type Page } from "@playwright/test";
import { focused } from "./helpers";

test.describe("keyboard", () => {
  test("the skip link is the first stop and is visible when focused", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect.poll(() => focused(page)).toMatchObject({ tag: "a", label: "Skip to content" });
    await expect(skip).toBeInViewport();
    await expect(skip).toHaveAttribute("href", "#main");
  });

  test("loop dial: arrows, Home and End turn it; quick repeats all count; it wraps", async ({ page }) => {
    await page.goto("/");
    const dial = page.getByRole("slider", { name: "Investigation loop" });
    await dial.scrollIntoViewIfNeeded();
    await dial.focus();
    await page.keyboard.press("Home");
    await expect(dial).toHaveAttribute("aria-valuenow", "1");
    await expect(dial).toHaveAttribute("aria-valuetext", /^Question/);
    await page.keyboard.press("ArrowRight");
    await expect(dial).toHaveAttribute("aria-valuenow", "2");
    // Two presses in quick succession move two steps, even while the dial is still turning.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(dial).toHaveAttribute("aria-valuenow", "4");
    await page.keyboard.press("ArrowLeft");
    await expect(dial).toHaveAttribute("aria-valuenow", "3");
    await page.keyboard.press("End");
    await expect(dial).toHaveAttribute("aria-valuenow", "8");
    await expect(dial).toHaveAttribute("aria-valuetext", /^Improvement/);
    await page.keyboard.press("ArrowRight");
    await expect(dial).toHaveAttribute("aria-valuenow", "1");
    // Once someone has used it, it no longer turns by itself.
    await page.waitForTimeout(4000);
    await expect(dial).toHaveAttribute("aria-valuenow", "1");
  });

  test("grounding wipe: arrows, Home and End move between the draft and the published text", async ({ page }) => {
    await page.goto("/");
    const wipe = page.getByRole("slider", { name: /Compare the model/ });
    await wipe.scrollIntoViewIfNeeded();
    await wipe.focus();
    await expect(wipe).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("ArrowRight");
    await expect(wipe).toHaveAttribute("aria-valuenow", "1");
    await expect(wipe).toHaveAttribute("aria-valuetext", /measured values/);
    await page.keyboard.press("ArrowLeft");
    await expect(wipe).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("End");
    await expect(wipe).toHaveAttribute("aria-valuenow", "1");
    await page.keyboard.press("Home");
    await expect(wipe).toHaveAttribute("aria-valuenow", "0");
    // The page did not scroll sideways or jump while the keys were pressed.
    expect(await page.evaluate(() => window.scrollX)).toBe(0);

    // The "sneak in a number" toggle works from the keyboard and announces the result.
    const sneak = page.getByRole("button", { name: "Let the model sneak in a number" });
    await sneak.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Undo" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status").filter({ hasText: "40%" })).toBeVisible();
  });

  test("scrubber: arrows, Home and End move through the stages; the play button works", async ({ page }) => {
    await page.goto("/");
    const scrub = page.getByRole("slider", { name: "Investigation stage" });
    await scrub.scrollIntoViewIfNeeded();
    await scrub.focus();
    await page.keyboard.press("Home");
    await expect(scrub).toHaveAttribute("aria-valuenow", "1");
    await expect(scrub).toHaveAttribute("aria-valuetext", "Question");
    await page.keyboard.press("ArrowRight");
    await expect(scrub).toHaveAttribute("aria-valuenow", "2");
    await page.keyboard.press("End");
    await expect(scrub).toHaveAttribute("aria-valuenow", "5");
    await expect(scrub).toHaveAttribute("aria-valuetext", "Conclusion");
    await page.keyboard.press("ArrowLeft");
    await expect(scrub).toHaveAttribute("aria-valuenow", "4");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("The system prompt caused the drop.")).toBeVisible();

    // Replay from the keyboard runs it again from the start.
    const play = page.getByRole("button", { name: "Replay" });
    await play.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 20_000 });
    await expect(scrub).toHaveAttribute("aria-valuenow", "5");
  });

  test("billing switch: Space and Enter toggle it, and the prices follow", async ({ page }) => {
    await page.goto("/pricing");
    const sw = page.getByRole("switch", { name: "Bill yearly" });
    await sw.focus();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Space");
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Billed yearly at $468")).toBeVisible();
    await page.keyboard.press("Space");
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Billed yearly at $468")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("menu sheet (phone)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function openWithKeyboard(page: Page, key: "Enter" | "Space") {
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.focus();
    await page.keyboard.press(key);
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => focused(page)).toMatchObject({ inDialog: true });
    return { trigger, dialog };
  }

  test("opens from the keyboard, Escape closes it, focus returns to the trigger", async ({ page }) => {
    await page.goto("/about");
    const { trigger, dialog } = await openWithKeyboard(page, "Enter");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => focused(page)).toMatchObject({ label: "Open menu" });
  });

  test("Tab and Shift+Tab stay inside the open sheet; the page behind is inert", async ({ page }) => {
    await page.goto("/");
    const { dialog } = await openWithKeyboard(page, "Space");
    const stops = await dialog.locator("a[href], button:not([disabled])").count();
    expect(stops).toBeGreaterThan(2);
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Tab");
      expect(await focused(page), `Tab ${i + 1}`).toMatchObject({ inDialog: true });
    }
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await focused(page), `Shift+Tab ${i + 1}`).toMatchObject({ inDialog: true });
    }
    // Nothing behind the sheet can be reached or clicked while it is open.
    await expect(page.locator("main")).toHaveAttribute("inert", "");
    await expect(page.locator("footer")).toHaveAttribute("inert", "");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    await expect.poll(() => focused(page)).toMatchObject({ label: "Open menu" });
  });

  test("a link in the sheet navigates and closes it", async ({ page }) => {
    await page.goto("/");
    const { dialog } = await openWithKeyboard(page, "Enter");
    await dialog.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free during early access.");
  });
});
