import { expect, test, type Page } from "@playwright/test";
import { ROUTES, scrollThrough } from "./helpers";

/** Starts summing layout shifts (as Cumulative Layout Shift does, ignoring those right after input) before the page loads. */
async function recordShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: { value: number; sources: string[] }[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      }[]) {
        if (e.hadRecentInput) continue;
        const sources = (e.sources ?? []).map((s) => {
          const el = s.node instanceof Element ? s.node : s.node?.parentElement;
          return el ? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` : "?";
        });
        w.__shifts.push({ value: e.value, sources });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

const shifts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shifts: { value: number; sources: string[] }[] }).__shifts);

for (const width of [375, 1440]) {
  for (const route of ROUTES) {
    test(`${route} at ${width}px: no layout shift while it loads and plays`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await recordShifts(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // The hero types out questions of different lengths; the dial turns by itself. Neither may move the page.
      await page.waitForTimeout(5000);
      if (route === "/") {
        await page.getByRole("slider", { name: "Investigation loop" }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(7500);
      }
      await scrollThrough(page);
      await page.waitForTimeout(500);
      const all = await shifts(page);
      const cls = all.reduce((s, e) => s + e.value, 0);
      expect(cls, JSON.stringify(all, null, 1)).toBeLessThan(0.01);
      await ctx.close();
    });
  }
}

test("system fonts only: no font files are downloaded", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "font" || /\.(woff2?|ttf|otf)(\?|$)/.test(r.url())) fonts.push(r.url());
  });
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
  }
  expect(fonts).toEqual([]);
});

test("nothing blocks the first paint but the stylesheet", async ({ request }) => {
  for (const route of ROUTES) {
    const html = await (await request.get(route)).text();
    const head = html.slice(0, html.indexOf("</head>"));
    // Every external script is async (a noModule polyfill is never fetched by a modern browser).
    const scripts = [...head.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    const blocking = scripts.filter((s) => /\ssrc=/.test(s) && !/\s(async|defer|nomodule)\b/i.test(s) && !/type="module"/.test(s));
    expect(blocking, `${route}: ${blocking.join(" ")}`).toEqual([]);
    const sheets = [...head.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)];
    expect(sheets.length, route).toBeLessThanOrEqual(1);
    // No raster images in the page; anything that is one must declare its size.
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const img of imgs) expect(img, route).toMatch(/\swidth=.+\sheight=|\sheight=.+\swidth=/);
  }
});

test("the hero paints first and fast (production build, local server)", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const m = await page.evaluate(
    () =>
      new Promise<{ fcp: number; lcp: number; lcpText: string }>((resolve) => {
        const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1;
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as unknown as { startTime: number; element?: Element | null }[];
          const last = entries[entries.length - 1];
          resolve({ fcp, lcp: last.startTime, lcpText: last.element?.textContent?.slice(0, 60) ?? last.element?.tagName ?? "" });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
  test.info().annotations.push({ type: "paint", description: `FCP ${Math.round(m.fcp)} ms, LCP ${Math.round(m.lcp)} ms (${m.lcpText})` });
  expect(m.fcp).toBeGreaterThan(0);
  expect(m.fcp).toBeLessThan(1500);
  expect(m.lcp).toBeLessThan(2500);
});
