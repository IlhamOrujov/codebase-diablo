import { expect, test } from "@playwright/test";
import { ORIGIN, ROUTES, scrollThrough, settle, watchConsole } from "./helpers";

for (const route of ROUTES) {
  test(`${route}: 200, no console errors or warnings`, async ({ page }) => {
    const messages = watchConsole(page);
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await scrollThrough(page);
    await settle(page);
    expect(messages, messages.join("\n")).toEqual([]);
  });

  test(`${route}: title, description, canonical, Open Graph and Twitter card`, async ({ page }) => {
    await page.goto(route);
    const head = page.locator("head");
    const url = `${ORIGIN}${route === "/" ? "" : route}`;
    await expect(page).toHaveTitle(/Diablo AI/);
    await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`^${url}/?$`));
    await expect(head.locator('meta[property="og:url"]')).toHaveAttribute("content", new RegExp(`^${url}/?$`));
    await expect(head.locator('meta[property="og:title"]')).toHaveAttribute("content", /Diablo AI/);
    await expect(head.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Diablo AI");
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`^${ORIGIN}/`));
    await expect(head.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(head.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(head.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /\S/);
    await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(head.locator('meta[name="twitter:image"]')).toHaveAttribute("content", new RegExp(`^${ORIGIN}/`));
  });
}

test("every page has its own title and description", async ({ page }) => {
  const seen = new Map<string, string>();
  for (const route of ROUTES) {
    await page.goto(route);
    const title = await page.title();
    const description = await page.locator('head meta[name="description"]').getAttribute("content");
    for (const value of [title, description ?? ""]) {
      expect(seen.get(value), `${route} repeats ${JSON.stringify(value)}`).toBeUndefined();
      seen.set(value, route);
    }
  }
});

test("the Open Graph image is a 1200×630 PNG served by the site itself", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('head meta[property="og:image"]').getAttribute("content");
  const tw = await page.locator('head meta[name="twitter:image"]').getAttribute("content");
  for (const abs of [og, tw]) {
    const u = new URL(abs!);
    // The tag points at production; fetch the same path from this server.
    const res = await request.get(u.pathname + u.search);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const png = await res.body();
    // IHDR: width and height are big-endian at bytes 16 and 20.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
});

test("sitemap.xml lists the four pages; robots.txt points to it", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, ""));
  expect(locs.sort()).toEqual(ROUTES.map((r) => `${ORIGIN}${r === "/" ? "" : r}`).sort());

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const txt = await robots.text();
  expect(txt).toMatch(/User-Agent: \*/i);
  expect(txt).toMatch(/Allow: \//);
  expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
});

test("an unknown page is a real 404 with a way home", async ({ page }) => {
  const messages = watchConsole(page);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing measured here.");
  await expect(page.getByRole("link", { name: "Back to the overview" })).toHaveAttribute("href", "/");
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // The browser reports the 404 document itself as a failed resource; nothing else may be logged.
  expect(messages.filter((m) => !/404 \(Not Found\)/.test(m)), messages.join("\n")).toEqual([]);
});
