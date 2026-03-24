import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the automated UI audit system.
 *
 * Runs against the local web app (apps/web) on port 3000.
 * The `webServer` block auto-starts the dev server if not already running.
 */
export default defineConfig({
  testDir: "./ui-audit/tests",
  outputDir: "./ui-audit/test-results",
  timeout: 60_000,
  retries: 0,
  workers: 1, // sequential — we're capturing screenshots, not racing
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: "./ui-audit/reports/playwright-results.json" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    screenshot: "off", // we capture manually for control
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "mobile-se",
      use: {
        ...devices["iPhone SE"],
        // Force Chromium — we only install Chromium for CI speed
        browserName: "chromium" as const,
        channel: undefined,
      },
    },
    {
      name: "mobile-14",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium" as const,
        channel: undefined,
      },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
    },
    {
      name: "laptop",
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: "npm run dev --prefix apps/web",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
