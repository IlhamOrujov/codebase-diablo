import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The live investigation page. The test server has no model key (see
 * playwright.config.ts), so these check the honest "needs a key" state and
 * that the run API refuses without calling any model.
 */

test("Signed in, /live explains the planted change and says plainly that it needs a model key", async ({ page }) => {
  await page.goto("/live");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live investigation");
  await expect(page.getByText("Helper v2 shipped two changes at once")).toBeVisible();
  await expect(page.getByRole("list", { name: "Helper versions" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Live runs need a model key" })).toBeVisible();
  await expect(page.getByText("nothing on this page is simulated")).toBeVisible();
  await expect(page.getByRole("link", { name: /platform\.claude\.com/ })).toHaveAttribute("href", "https://platform.claude.com/settings/keys");
  await expect(page.getByText("ANTHROPIC_API_KEY", { exact: true })).toBeVisible();
  await expect(page.getByText("one run makes at most 165 model calls")).toBeVisible();
  const run = page.getByRole("button", { name: /Run live investigation/ });
  await expect(run).toHaveAttribute("aria-disabled", "true");
  await run.click({ force: true });
  await expect(page.getByRole("list", { name: "Stages" })).toHaveCount(0);
});

test("The run API refuses without a key (503), cross-site (403) and without a method it knows (405)", async ({ page, baseURL }) => {
  await page.goto("/live");
  const ok = await page.request.post("/api/live/run", { headers: { Origin: baseURL!, "Content-Type": "application/json" }, data: "{}" });
  expect(ok.status()).toBe(503);
  expect(ok.headers()["cache-control"]).toContain("no-store");
  const body = await ok.json();
  expect(body.error).toBe("not_configured");
  expect(body.message).toMatch(/ANTHROPIC_API_KEY/);

  const cross = await page.request.post("/api/live/run", { headers: { Origin: "https://evil.example" }, data: "{}" });
  expect(cross.status()).toBe(403);
  expect((await page.request.get("/api/live/run")).status()).toBe(405);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/live redirects to sign-in and the run API answers 401", async ({ page, request, baseURL }) => {
    await page.goto("/live");
    expect(new URL(page.url()).pathname).toBe("/");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/live");
    const res = await request.post("/api/live/run", { headers: { Origin: baseURL! }, data: "{}" });
    expect(res.status()).toBe(401);
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`/live passes axe and has no horizontal scroll, ${theme}, 375 and 1440 px`, async ({ browser }) => {
    const problems: string[] = [];
    for (const width of [375, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, storageState: "e2e/.auth/demo.json" });
      const page = await ctx.newPage();
      await page.goto("/live");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "Live runs need a model key" })).toBeVisible();
      const overflow = await page.evaluate(() => {
        const main = document.getElementById("main");
        return document.documentElement.scrollWidth > window.innerWidth + 1 || (main ? main.scrollWidth > main.clientWidth + 1 : false);
      });
      if (overflow) problems.push(`${width}px: horizontal scroll`);
      // @axe-core/playwright bundles a newer playwright-core; its Page type differs only in methods axe never calls.
      const result = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      for (const v of result.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
        problems.push(`${width}px: ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`);
      }
      await ctx.close();
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
