import { expect, test, type Locator, type Page } from "@playwright/test";

/** Drags with the mouse in small steps, so the gesture code sees a real pan with velocity. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function box(l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw new Error("not visible");
  return b;
}

const transformOf = (l: Locator) => l.evaluate((el) => getComputedStyle(el).transform);

test.describe("pointer gestures still work", () => {
  test("fling tile follows the pointer and springs home", async ({ page }) => {
    await page.goto("/");
    const tile = page.getByRole("img", { name: "Diablo" }).locator("xpath=..");
    const b = await box(tile);
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 30, c.y + 20, { steps: 6 });
    expect(await transformOf(tile)).not.toBe("none");
    await page.mouse.up();
    await expect.poll(() => tile.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41), { timeout: 5000 }).toBeCloseTo(0, 0);
  });

  test("loop dial turns when dragged around its rim", async ({ page }) => {
    await page.goto("/");
    const dial = page.getByRole("slider", { name: "Investigation loop" });
    await dial.focus();
    await page.keyboard.press("Home");
    await expect(dial).toHaveAttribute("aria-valuenow", "1");
    const b = await box(dial);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const r = b.width * 0.4;
    // A quarter turn anticlockwise, from 12 o'clock to 9 o'clock, brings a later step to the top.
    await page.mouse.move(cx, cy - r);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) {
      const a = -Math.PI / 2 - (Math.PI / 2) * (i / 16);
      await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(150);
    await page.mouse.up();
    await expect.poll(async () => Number(await dial.getAttribute("aria-valuenow"))).toBeGreaterThan(1);
  });

  test("grounding wipe follows a drag to the published side and back", async ({ page }) => {
    await page.goto("/");
    const wipe = page.getByRole("slider", { name: /Compare the model/ });
    const b = await box(wipe);
    const y = b.y + b.height / 2;
    await drag(page, { x: b.x + 4, y }, { x: b.x + b.width - 4, y });
    await expect(wipe).toHaveAttribute("aria-valuenow", "1");
    await drag(page, { x: b.x + b.width - 4, y }, { x: b.x + 4, y });
    await expect(wipe).toHaveAttribute("aria-valuenow", "0");
  });

  test("scrubber follows a drag along the rail", async ({ page }) => {
    await page.goto("/");
    const scrub = page.getByRole("slider", { name: "Investigation stage" });
    const b = await box(scrub);
    const y = b.y + b.height / 2;
    await drag(page, { x: b.x + 2, y }, { x: b.x + b.width * 0.5, y });
    await expect(scrub).toHaveAttribute("aria-valuenow", "3");
    await drag(page, { x: b.x + b.width * 0.5, y }, { x: b.x + b.width - 2, y });
    await expect(scrub).toHaveAttribute("aria-valuenow", "5");
  });

  test("billing switch: a tap toggles it, a drag sets it", async ({ page }) => {
    await page.goto("/pricing");
    const sw = page.getByRole("switch", { name: "Bill yearly" });
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    const b = await box(sw);
    const y = b.y + b.height / 2;
    await drag(page, { x: b.x + b.width - 8, y }, { x: b.x - 10, y });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    // The labels beside it work too.
    await page.getByRole("button", { name: /^Yearly/ }).click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
  });

  test("flywheel spins when dragged", async ({ page }) => {
    await page.goto("/about");
    const label = page.getByText("Gains experience");
    const wheel = label.locator("xpath=ancestor::div[contains(@class,'aspect-square')][1]");
    const spinner = wheel.locator("> div").first();
    const b = await box(wheel);
    await page.waitForTimeout(2500); // let the first small turn coast out
    const before = await transformOf(spinner);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await drag(page, { x: cx + b.width * 0.4, y: cy }, { x: cx, y: cy + b.height * 0.4 });
    await expect.poll(() => transformOf(spinner)).not.toBe(before);
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("menu sheet closes when pulled down", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Open menu" }).click();
      const sheet = page.getByRole("dialog", { name: "Menu" });
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(500);
      const b = await box(sheet);
      await drag(page, { x: b.x + b.width / 2, y: b.y + 12 }, { x: b.x + b.width / 2, y: b.y + 360 }, 8);
      await expect(sheet).toBeHidden();
      await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    });

    test("menu sheet closes when the scrim is tapped", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Open menu" }).click();
      const sheet = page.getByRole("dialog", { name: "Menu" });
      await expect(sheet).toBeVisible();
      await page.mouse.click(187, 60);
      await expect(sheet).toBeHidden();
    });
  });
});
