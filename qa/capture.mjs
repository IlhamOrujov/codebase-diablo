// Screenshot every route at several widths in light and dark.
// Usage: node qa/capture.mjs <outDir> [baseUrl]
// Cross-platform: plain Node + Playwright, no shell features.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "qa/after";
const base = process.argv[3] ?? "http://localhost:3100";
const widths = (process.env.QA_WIDTHS ?? "320,768,1440").split(",").map(Number);
const routes = (process.env.QA_ROUTES ??
  "/,/home,/investigations,/investigations/sycophancy-model-x,/systems,/experiments,/evidence,/reports,/datasets,/settings,/nope").split(",");

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("diablo.theme", t);
        localStorage.setItem("diablo.seen", "1");
      } catch {}
    }, theme);
    const page = await ctx.newPage();
    for (const r of routes) {
      const name = (r === "/" ? "signin" : r.slice(1).replace(/[^a-z0-9]+/gi, "-")) + `-${width}-${theme}.jpg`;
      try {
        await page.goto(base + r, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        // The app scrolls inside <main>; let it flow so a full-page screenshot shows everything.
        await page.addStyleTag({ content: ".app-frame,.app-main{height:auto!important;overflow:visible!important} .sidebar{position:sticky;top:0}" });
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(out, name), fullPage: true, type: "jpeg", quality: 60 });
      } catch (e) {
        console.error("failed", r, width, theme, e.message);
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log("saved to", out);
