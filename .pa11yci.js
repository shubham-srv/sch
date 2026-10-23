// pa11y-ci configuration. JavaScript so the target URL can come from env.
// Chrome: pa11y uses Playwright's Chromium (installed by
// `pnpm exec playwright install chromium`) instead of Puppeteer's own
// download, which pnpm blocks; see pnpm-workspace.yaml.
const { chromium } = require("@playwright/test");

const baseUrl = (process.env.A11Y_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const reportFile = process.env.A11Y_REPORT_FILE;

module.exports = {
  defaults: {
    standard: "WCAG2AA",
    runners: ["axe", "htmlcs"],
    timeout: 60_000,
    chromeLaunchConfig: {
      executablePath: chromium.executablePath(),
      args: ["--no-sandbox"],
    },
    reporters: reportFile
      ? ["cli", ["json", { fileName: reportFile }]]
      : ["cli"],
    // Every entry needs a comment explaining why it is safe to ignore.
    ignore: [],
  },
  urls: [`${baseUrl}/`],
};
