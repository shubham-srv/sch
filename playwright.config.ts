import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const MOCK_API_URL = "http://127.0.0.1:4010";

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
  // With no PLAYWRIGHT_BASE_URL, run the production server and the mock API
  // as host processes. Locally, servers that are already running (for
  // example the compose stack) are reused.
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command: "pnpm mock-api",
          url: `${MOCK_API_URL}/greeting`,
          reuseExistingServer: !isCI,
        },
        {
          command: "pnpm build && pnpm start",
          url: "http://localhost:3000/api/health",
          env: { API_BASE_URL: MOCK_API_URL },
          reuseExistingServer: !isCI,
          timeout: 300_000,
        },
      ],
});
