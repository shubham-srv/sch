// pa11y-ci configuration. JavaScript so the target URL can come from env.
// Chrome: pa11y uses Playwright's Chromium (installed by
// `yarn playwright install chromium`) instead of Puppeteer's own
// download, which Yarn blocks; see enableScripts in .yarnrc.yml.
const { chromium } = require("@playwright/test");

const baseUrl = (process.env.A11Y_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const reportFile = process.env.A11Y_REPORT_FILE;
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

// Signed-in pages are checked only when the E2E test account is set: pa11y
// signs in through Microsoft's screens first. The ids are Microsoft's and may
// change. Remove the two "Stay signed in?" steps if the tenant turns it off.
const signInActions = [
  "click element form[aria-label='Sign in'] button",
  "wait for element #i0116 to be visible",
  `set field #i0116 to ${username}`,
  "click element #idSIButton9",
  "wait for element #i0118 to be visible",
  `set field #i0118 to ${password}`,
  "click element #idSIButton9",
  "wait for element #idBtn_Back to be visible",
  "click element #idBtn_Back",
  "wait for path to be /",
  "wait for element main h1 to be visible",
];

const signedInUrls =
  username && password
    ? [
        // Signed out, / redirects to the login page, where the actions start.
        { url: `${baseUrl}/`, actions: signInActions },
      ]
    : [];

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
  urls: [`${baseUrl}/login`, ...signedInUrls],
};
