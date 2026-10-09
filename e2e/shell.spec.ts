import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers";

test("4. Ctrl/⌘+K opens the palette, also for code KeyK with key л; Esc closes; focus returns", async ({ page }) => {
  await gotoHome(page);
  const trigger = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /^Search/ });
  // Home focuses its composer first. Checked as the active element: a headless page has no
  // window focus until the first interaction, so toBeFocused() would report "inactive".
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("composer-input");
  await trigger.focus();
  await page.keyboard.press("Control+KeyK");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Russian layout: the K key produces "л", but event.code is still KeyK.
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "л", code: "KeyK", ctrlKey: true, bubbles: true, cancelable: true })),
  );
  await expect(dialog).toBeVisible();
  await page.keyboard.type("long");
  await expect(dialog.getByRole("option", { name: /Long-context degradation/ })).toBeVisible();
  await page.keyboard.type("zzzz");
  await expect(dialog.getByText("No results for")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("5. ?tab=garbage and ?exp=zzz fall back; unknown ids and paths are real 404s", async ({ page }) => {
  await page.goto("/investigations/tool-use-reliability?tab=garbage&exp=zzz");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("complementary", { name: "Experiment details" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tool-use reliability");

  for (const path of ["/investigations/nope", "/definitely-not-a-page"]) {
    const res = await page.goto(path);
    expect(res!.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  }
});

test("6. Reduced motion: no infinitely repeating animation, running dot included", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/investigations/sycophancy-model-x");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  const infinite = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState !== "finished").length,
  );
  expect(infinite).toBe(0);
  await ctx.close();
});

test("6b. Without reduced motion the only infinite animations show a live state: the running pulse and running edges", async ({ page }) => {
  for (const tab of ["overview", "graph"]) {
    await page.goto(`/investigations/sycophancy-model-x?tab=${tab}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    const names = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations === Infinity)
        .map((a) => (a as CSSAnimation).animationName),
    );
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(["running-pulse", "edge-flow"]).toContain(n);
  }
});

test("7. Theme persists across reload, before first paint, and on the 404 page", async ({ page }) => {
  const raw = await (await page.request.get("/home")).text();
  expect(raw).not.toMatch(/<html[^>]*data-theme=/);

  await gotoHome(page);
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");

  await page.goto("/home", { waitUntil: "commit" });
  // At "commit" the new document may not have an <html> element yet; wait for it, then for the attribute.
  await page.waitForFunction(() => document.documentElement?.hasAttribute("data-theme") ?? false);
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");

  const res = await page.goto("/no-such-page");
  expect(res!.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(23, 19, 21)");

  await page.goto("/settings");
  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await theme.getByRole("radio", { name: "Light" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.getByRole("radio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("11. Corrupt sessionStorage gives a recovery banner and no crash", async ({ page }) => {
  await gotoHome(page);
  await page.waitForTimeout(500); // let the first (debounced) save land
  await page.evaluate(() => sessionStorage.setItem("diablo.workspace", "{corrupt"));
  await page.reload();
  const banner = page.getByRole("alert").filter({ hasText: "could not be read" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Describe what you want to find out about an AI system" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});

test("12. Legal pages: account menu, sign-in, Home footer, mobile drawer; one h1 each", async ({ page, browser }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Privacy Policy" }).click();
  await page.waitForURL(/\/legal\/privacy/);
  await expect(page.locator("h1:visible")).toHaveCount(1);

  // Sign-in is for signed-out visitors (signed-in ones go straight to /home).
  const out = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const signIn = await out.newPage();
  await signIn.goto("/");
  await signIn.getByRole("link", { name: "Terms of Service" }).click();
  await signIn.waitForURL(/\/legal\/terms/);
  await expect(signIn.locator("h1:visible")).toHaveCount(1);
  await out.close();

  await gotoHome(page);
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Usage Policy" }).click();
  await page.waitForURL(/\/legal\/usage/);
  await expect(page.locator("h1:visible")).toHaveCount(1);

  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const m = await ctx.newPage();
  await m.goto("/home");
  await m.getByRole("button", { name: "Open menu" }).click();
  const drawer = m.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /^Account:/ }).click();
  await m.getByRole("menuitem", { name: "Terms of Service" }).click();
  await m.waitForURL(/\/legal\/terms/);
  await expect(m.locator("h1:visible")).toHaveCount(1);
  await ctx.close();
});

test("14. Sidebar: first paint at the final width; collapsing changes main's width in at most 2 steps", async ({ page }) => {
  await page.goto("/home");
  await page.evaluate(() => localStorage.setItem("diablo.sidebar", "collapsed"));
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const w0 = await page.evaluate(() => document.querySelector("aside.sidebar")!.getBoundingClientRect().width);
  expect(Math.round(w0)).toBe(56);

  await page.evaluate(() => localStorage.removeItem("diablo.sidebar"));
  await page.goto("/home");
  expect(Math.round(await page.evaluate(() => document.querySelector("aside.sidebar")!.getBoundingClientRect().width))).toBe(256);
  await page.evaluate(() => {
    const w = window as unknown as { widths: number[] };
    w.widths = [];
    const main = document.getElementById("main")!;
    const tick = () => {
      w.widths.push(Math.round(main.getBoundingClientRect().width));
      if (w.widths.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press("Control+Backslash");
  await page.waitForTimeout(1200);
  const widths = await page.evaluate(() => (window as unknown as { widths: number[] }).widths);
  expect(new Set(widths).size).toBeLessThanOrEqual(2);
  expect(Math.round(await page.evaluate(() => document.querySelector("aside.sidebar")!.getBoundingClientRect().width))).toBe(56);
});

test("15. Idle on Home with nothing running: no storage writes, no animation", async ({ page }) => {
  test.setTimeout(60_000);
  await gotoHome(page);
  // Remove the one running investigation so nothing runs.
  await page.getByRole("button", { name: "Options for Sycophancy in Model X" }).click({ force: true });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Describe what you want to find out about an AI system" })).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { writes: number };
    w.writes = 0;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === sessionStorage) w.writes++;
      return orig.call(this, k, v);
    };
  });
  await page.waitForTimeout(12_000);
  const writes = await page.evaluate(() => (window as unknown as { writes: number }).writes);
  expect(writes).toBe(0);
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  expect(running).toBe(0);
});
