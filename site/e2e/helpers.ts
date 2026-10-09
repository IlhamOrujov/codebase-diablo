import type { Page } from "@playwright/test";

export const ORIGIN = "https://diablo.pnoia.dev";

export const ROUTES = ["/", "/about", "/team", "/pricing"] as const;

/** Collects console errors and warnings and uncaught exceptions for a page. */
export function watchConsole(page: Page) {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()} ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror ${page.url()}: ${e.message}`));
  return messages;
}

/** Scrolls through the whole page so every section has been in view once, then returns to `to`. */
export async function scrollThrough(page: Page, to: "top" | "bottom" = "bottom") {
  await page.evaluate(async (end) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    const step = Math.max(200, window.innerHeight * 0.5);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await frame();
    }
    window.scrollTo(0, end === "top" ? 0 : document.documentElement.scrollHeight);
    await frame();
  }, to);
}

/** Waits until every finite animation on the page has finished (infinite ones, like a caret, are ignored). */
export async function settle(page: Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
    null,
    { timeout: 15_000 },
  );
}

/** The element that has focus. Headless Chromium here reports document.hasFocus() as false, so read activeElement. */
export function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      label: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
      inDialog: !!el.closest('[role="dialog"]'),
    };
  });
}
