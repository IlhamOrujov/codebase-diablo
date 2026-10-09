import { expect, test, type Page } from "@playwright/test";
import { ROUTES, scrollThrough, watchConsole } from "./helpers";

/** Visible text inside <main> that is not fully opaque (the product of every ancestor's opacity). */
function faintText(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const main = document.querySelector("main");
    if (!main) return ["no <main>"];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      if (getComputedStyle(el).visibility === "hidden" || el.getClientRects().length === 0) continue;
      let o = 1;
      for (let a: Element | null = el; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
      if (o < 0.999) out.push(`${text.slice(0, 48)} (opacity ${o.toFixed(2)})`);
    }
    return out;
  });
}

/** Every element's transform, so two moments can be compared. */
function transforms(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("body *")].map((el) => `${el.tagName}:${getComputedStyle(el).transform}`).join("\n"),
  );
}

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  for (const route of ROUTES) {
    test(`${route}: everything is shown at once and nothing moves`, async ({ page }) => {
      const messages = watchConsole(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      // Without scrolling: no block waits to be revealed.
      expect(await faintText(page)).toEqual([]);

      // Scroll through (nothing animates in), then watch for movement for a while.
      await scrollThrough(page);
      if (route === "/") await page.getByRole("slider", { name: "Investigation loop" }).scrollIntoViewIfNeeded();
      const before = await transforms(page);
      await page.waitForTimeout(4000);
      expect(await transforms(page)).toBe(before);
      expect(messages, messages.join("\n")).toEqual([]);
    });
  }

  test("home: the dial stays put, the example is shown finished, the question is shown whole", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".caret")).toBeHidden();
    await expect(page.getByRole("button", { name: /^Example question: .+\? Show the next one\.$/ })).toBeVisible();
    const scrub = page.getByRole("slider", { name: "Investigation stage" });
    await expect(scrub).toHaveAttribute("aria-valuenow", "5");
    await expect(page.getByText("The system prompt caused the drop.")).toBeVisible();
    const dial = page.getByRole("slider", { name: "Investigation loop" });
    await dial.scrollIntoViewIfNeeded();
    const at = await dial.getAttribute("aria-valuenow");
    await page.waitForTimeout(4000);
    await expect(dial).toHaveAttribute("aria-valuenow", at!);
    // Keys still work, without travel.
    await dial.focus();
    await page.keyboard.press("ArrowRight");
    await expect(dial).toHaveAttribute("aria-valuenow", String(Number(at) + 1));
  });
});

test.describe("full motion", () => {
  test("a block below the fold waits for its moment, then settles in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const band = page.getByRole("heading", { name: "Investigate your AI." });
    const opacity = () => band.evaluate((el) => {
      let o = 1;
      for (let a: Element | null = el; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
      return o;
    });
    expect(await opacity()).toBe(0);
    await band.scrollIntoViewIfNeeded();
    await expect.poll(opacity, { timeout: 5000 }).toBe(1);
  });

  test("the first screen is never blank: the hero is painted from the server HTML", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI that evolves AI.");
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const route of ROUTES) {
    test(`${route}: every section is readable`, async ({ page }) => {
      await page.goto(route);
      // The CSS entrance on the first screen lasts about a second.
      await page.waitForTimeout(1500);
      await scrollThrough(page).catch(() => {});
      expect(await faintText(page)).toEqual([]);
    });
  }
});
