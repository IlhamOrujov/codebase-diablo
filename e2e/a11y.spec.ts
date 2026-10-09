import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/home",
  "/investigations",
  "/investigations/sycophancy-model-x?tab=session",
  "/investigations/sycophancy-model-x?tab=overview",
  "/investigations/long-context-degradation?tab=graph",
  "/investigations/tool-use-reliability?tab=evidence",
  "/investigations/tool-use-reliability?tab=report",
  "/systems",
  "/experiments",
  "/evidence",
  "/datasets",
  "/reports",
  "/settings",
  "/legal/terms",
  "/legal/privacy",
  "/legal/usage",
  "/no-such-page",
];

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`axe: 0 serious or critical issues, ${theme}, ${width}px`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await ctx.newPage();
      const problems: string[] = [];
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        // @axe-core/playwright bundles a newer playwright-core; its Page type differs only in methods axe never calls.
        const result = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        for (const v of result.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
          problems.push(`${route}: ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`);
        }
      }
      expect(problems, problems.join("\n")).toEqual([]);
      await ctx.close();
    });
  }
}

test("No console errors or warnings on any route (production build, CSP included)", async ({ page }) => {
  test.setTimeout(120_000);
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(`${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`${page.url()}: ${e.message}`));
  for (const route of ROUTES.filter((r) => r !== "/no-such-page")) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
  }
  expect(messages, messages.join("\n")).toEqual([]);
});

test("13. No horizontal scroll at any width, light and dark", async ({ browser }) => {
  test.setTimeout(180_000);
  const overflow: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 375, 768, 1024, 1280, 1440, 1920]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await ctx.newPage();
      for (const route of ["/", "/home", "/investigations", "/investigations/sycophancy-model-x?tab=overview", "/settings", "/legal/privacy"]) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const bad = await page.evaluate(() => {
          const doc = document.documentElement.scrollWidth > window.innerWidth + 1;
          const main = document.getElementById("main");
          const m = main ? main.scrollWidth > main.clientWidth + 1 : false;
          return doc || m;
        });
        if (bad) overflow.push(`${theme} ${width} ${route}`);
      }
      await ctx.close();
    }
  }
  expect(overflow, overflow.join("\n")).toEqual([]);
});
