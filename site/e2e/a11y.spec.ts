import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROUTES, scrollThrough, settle } from "./helpers";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    for (const route of ROUTES) {
      test(`axe: no violations on ${route}, ${theme}, ${width}px`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
        const page = await ctx.newPage();
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        // Bring every section into view once, so what is checked is what a reader sees.
        await scrollThrough(page);
        if (route === "/") {
          // The worked example plays itself once it is seen; check it at rest.
          await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 20_000 });
        }
        await settle(page);
        // @axe-core/playwright bundles its own playwright-core; the Page types differ only in methods axe never calls.
        const result = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const problems = result.violations.map(
          (v) => `${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")} — ${v.help}`,
        );
        expect(problems, problems.join("\n")).toEqual([]);
        await ctx.close();
      });
    }
  }
}

test("axe: the open menu sheet has no violations (375px, light and dark)", async ({ browser }) => {
  for (const theme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto("/about");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await settle(page);
    const result = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
    const problems = result.violations.map((v) => `${theme}: ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target.join(" ")} — ${v.help}`);
    expect(problems, problems.join("\n")).toEqual([]);
    await ctx.close();
  }
});

test("no horizontal scroll at phone and desktop widths", async ({ browser }) => {
  const overflow: string[] = [];
  for (const width of [320, 375, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (wide) overflow.push(`${width}px ${route}`);
    }
    await ctx.close();
  }
  expect(overflow, overflow.join("\n")).toEqual([]);
});

test.describe("increased contrast", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`axe: no violations with more contrast, ${theme}; materials turn solid`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, colorScheme: theme, contrast: "more" });
      const page = await ctx.newPage();
      const problems: string[] = [];
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await scrollThrough(page);
        if (route === "/") await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 20_000 });
        await settle(page);
        const result = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        for (const v of result.violations) problems.push(`${route}: ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`);
      }
      const blur = await page.locator("header").evaluate((el) => getComputedStyle(el).backdropFilter);
      expect(blur).toBe("none");
      expect(problems, problems.join("\n")).toEqual([]);
      await ctx.close();
    });
  }
});
