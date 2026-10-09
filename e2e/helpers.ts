import { expect, type Page } from "@playwright/test";

/** Where the setup project saves the signed-in demo session. */
export const DEMO_STATE = "e2e/.auth/demo.json";

export const COMPOSER = "Describe what you want to find out about an AI system";

export async function gotoHome(page: Page) {
  await page.goto("/home");
  await expect(page.getByRole("textbox", { name: COMPOSER })).toBeVisible();
}

export async function ask(page: Page, question: string) {
  const box = page.getByRole("textbox", { name: COMPOSER });
  await box.fill(question);
  await box.press("Enter");
  await page.waitForURL(/\/investigations\/[a-z0-9-]+/);
}

/** The saved workspace, as the app persisted it (after its 250 ms debounce). */
export async function saved(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("diablo.workspace") ?? "null"));
}
