import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the public site, against the production build:
 *   npx next build && PORT=<port> npx playwright test
 * The server starts automatically, or an existing one on PORT is reused,
 * so always pass the port you mean. Browsers: `npx playwright install chromium`.
 */
const PORT = Number(process.env.PORT ?? 3214);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
