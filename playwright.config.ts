import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E tests always run against a real backend (docs/testing.md). Locally,
// .env.local supplies API_BASE_URL (your backend container) and, optionally,
// E2E_EXPECTED_GREETING.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const isCI = !!process.env.CI;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!externalBaseURL && !process.env.API_BASE_URL) {
  throw new Error(
    "E2E needs a running backend: set API_BASE_URL (for example in .env.local), " +
      "or set PLAYWRIGHT_BASE_URL to test an already deployed app.",
  );
}

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "test-results",
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "reports/junit/playwright.xml" }],
  ],
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // With no PLAYWRIGHT_BASE_URL, build the app and run the packaged server
  // (the same dist/app that is deployed). A server already running on port
  // 3000 is reused locally.
  webServer: externalBaseURL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !isCI,
        timeout: 300_000,
      },
});
