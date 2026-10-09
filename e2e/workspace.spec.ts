import { expect, test } from "@playwright/test";
import { saved } from "./helpers";

// Same maths as src/lib/stats.ts, re-derived here so the test checks the UI, not itself.
function mcnemarP(b: number, c: number) {
  const n = b + c;
  const lf = (x: number) => {
    let s = 0;
    for (let i = 2; i <= x; i++) s += Math.log(i);
    return s;
  };
  let tail = 0;
  for (let i = 0; i <= Math.min(b, c); i++) tail += Math.exp(lf(n) - lf(i) - lf(n - i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

test("9. Running a proposed experiment moves that same experiment to complete, with consistent numbers", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/investigations/instruction-following?tab=overview");
  await expect(page.getByText("Not enough evidence yet")).toBeVisible();
  await page.getByRole("button", { name: "Run proposed" }).first().click();
  await expect(page.getByRole("row", { name: /E1 Turn-depth sweep, running/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /E1 Turn-depth sweep, complete/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("row", { name: /Turn-depth sweep/ })).toHaveCount(1);

  const ws = await saved(page);
  const inv = ws.investigations.find((i: { id: string }) => i.id === "instruction-following");
  expect(inv.experiments).toHaveLength(1);
  const e = inv.experiments[0];
  expect(e.status).toBe("complete");
  const run = e.runs.find((r: { role: string }) => r.role === "primary");
  const { control, treatment } = run.counts;
  expect(control.n).toBe(500);
  expect(treatment.n).toBe(500);
  expect(treatment.k - control.k).toBe(run.discordant.c - run.discordant.b);

  // Open the panel and compare what it shows with the counts.
  await page.getByRole("row", { name: /E1 Turn-depth sweep/ }).click();
  const panel = page.getByRole("complementary", { name: "Experiment details" });
  await expect(panel).toBeVisible();
  const p = mcnemarP(run.discordant.b, run.discordant.c);
  const pText = p < 0.001 ? "< 0.001" : `= ${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`;
  await expect(panel.getByText("Exact McNemar test")).toBeVisible();
  await expect(panel.getByText(pText.replace("= ", ""), { exact: true })).toBeVisible();
  const diff = ((treatment.k - control.k) / 500) * 100;
  const ciText = await panel.getByText(/95% CI .* pp$/).first().innerText();
  const [lo, hi] = ciText
    .replace(/.*95% CI /, "")
    .replace(" pp", "")
    .split(" to ")
    .map((s) => Number(s.replace("−", "-")));
  expect(lo).toBeLessThanOrEqual(diff + 0.05);
  expect(hi).toBeGreaterThanOrEqual(diff - 0.05);
});

test("8. Keyboard: tabs move with arrows; graph nodes are reachable and open the panel; Esc closes", async ({ page }) => {
  await page.goto("/investigations/long-context-degradation");
  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  const graph = page.getByRole("tab", { name: "Graph" });
  await expect(graph).toHaveAttribute("aria-selected", "true");
  await expect(graph).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");

  const canvas = page.getByRole("application", { name: /Research graph/ });
  await expect(canvas).toBeVisible();
  const q = canvas.getByRole("button", { name: /^Question:/ });
  await q.focus();
  await page.keyboard.press("ArrowDown");
  await expect(canvas.getByRole("button", { name: /^Hypotheses: H1/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const e1 = canvas.getByRole("button", { name: /^Experiments: E1/ });
  await expect(e1).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("complementary", { name: "Experiment details" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Length sweep 8k–512k" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // Zoom survives a tab switch.
  await canvas.focus();
  await page.keyboard.press("+");
  const zoom = await canvas.getByText(/^\d+%$/).innerText();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await page.getByRole("tab", { name: "Graph" }).click();
  await expect(page.getByRole("application", { name: /Research graph/ }).getByText(/^\d+%$/)).toHaveText(zoom);
});

test("Session: a question gets a data-based answer that echoes it; unknown questions are declined", async ({ page }) => {
  await page.goto("/investigations/sycophancy-model-x?tab=session");
  const box = page.getByRole("textbox", { name: "Ask about this investigation or add a note" });
  await box.fill("What is the p-value of E1?");
  await box.press("Enter");
  const log = page.getByRole("list", { name: "Session log" });
  await expect(log.getByText("What is the p-value of E1?")).toBeVisible();
  await expect(log.getByText(/E1 \(Adversarial disagreement set\)/)).toBeVisible();
  await box.fill("Write me a poem about the ocean");
  await box.press("Enter");
  await expect(log.getByText(/can't answer that in demo mode/)).toBeVisible();
});

test("Evidence: outcome labels come from the metric; flagging a score is stored", async ({ page }) => {
  await page.goto("/investigations/sycophancy-model-x?tab=evidence");
  await page.getByLabel("Experiment").selectOption("E1");
  await expect(page.getByLabel("Outcome").locator("option", { hasText: "Agrees with the false claim" })).toHaveCount(1);
  await page.getByRole("button", { name: "Flag score" }).first().click();
  await expect(page.getByRole("button", { name: "Unflag score" })).toHaveCount(1);
  const ws = await saved(page);
  const flagged = ws.investigations[0].experiments.flatMap((e: { runs: { samples: { flagged: boolean }[] }[] }) =>
    e.runs.flatMap((r) => r.samples.filter((s) => s.flagged)),
  );
  expect(flagged).toHaveLength(1);
});

test("16. The report prints to more than one page", async ({ page }) => {
  await page.goto("/investigations/tool-use-reliability?tab=report");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4" });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThanOrEqual(2);
});
