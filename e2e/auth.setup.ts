import { expect, test as setup } from "@playwright/test";
import { COMPOSER, DEMO_STATE } from "./helpers";

/** Signs in once through the real demo route; every spec reuses the cookie. */
setup("sign in to the demo workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await page.waitForURL("**/home");
  await expect(page.getByRole("textbox", { name: COMPOSER })).toBeVisible();
  await page.context().storageState({ path: DEMO_STATE });
});
