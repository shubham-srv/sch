import { expect, test } from "@playwright/test";
import { AppShell } from "../pages/app-shell.page";
import { LoginPage } from "../pages/login.page";

// The test account's display name differs per environment. Set
// E2E_EXPECTED_USER_NAME to check it exactly.
const expectedUserName = process.env.E2E_EXPECTED_USER_NAME;

test.describe("signed out", { tag: "@smoke" }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a page redirects to the login page and remembers where it was", async ({
    page,
  }) => {
    await page.goto("/?from=e2e");

    await expect(page).toHaveURL("/login?next=%2F%3Ffrom%3De2e");
    await expect(new LoginPage(page).heading).toBeVisible();
  });

  test("the login page has one heading and the sign-in button", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(login.heading).toBeVisible();
    await expect(login.signInButton).toBeVisible();
    await expect(page).toHaveTitle("Sign in | Web");
  });
});

test.describe("signed in", () => {
  test(
    "the top bar shows the user and a sign-out button",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/");
      const shell = new AppShell(page);

      await expect(shell.signOutButton).toBeVisible();
      await expect(shell.navigation).toBeVisible();
      if (expectedUserName) {
        await expect(shell.userName(expectedUserName)).toBeVisible();
      }
    },
  );

  test("signing out returns to the login page and protects pages again", async ({
    page,
  }) => {
    await page.goto("/");
    await new AppShell(page).signOutButton.click();

    await expect(page).toHaveURL("/login");
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
});
