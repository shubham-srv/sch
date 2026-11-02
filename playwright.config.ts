import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { SIGNED_IN_STATE } from "./e2e/auth-state";

// E2E tests always run against a real backend and real Microsoft Entra ID
// (docs/testing.md). Locally, .env.local supplies API_BASE_URL (your backend
// container), the Entra settings, the test account (E2E_USERNAME,
// E2E_PASSWORD) and any optional E2E_EXPECTED_* values the tests read.
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
  projects: [
    // Signs in once with the test account; the tests then start signed in.
    // Signed-out tests opt out with test.use({ storageState: ... }).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: SIGNED_IN_STATE },
      dependencies: ["setup"],
    },
  ],
  // With no PLAYWRIGHT_BASE_URL, build the app and run the packaged server
  // (the same dist/app that is deployed). A server already running on port
  // 3000 is reused locally.
  webServer: externalBaseURL
    ? undefined
    : {
        command: "yarn build && yarn start",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !isCI,
        timeout: 300_000,
      },
});
