import { expect, test as setup } from "@playwright/test";
import { SIGNED_IN_STATE } from "../auth-state";
import { AppShell } from "../pages/app-shell.page";
import { LoginPage } from "../pages/login.page";
import { MicrosoftSignInPage } from "../pages/microsoft-sign-in.page";

// Signs in once through the real Microsoft sign-in with a test account and
// saves the cookies, so every other test starts signed in. Tagged @smoke
// because the production smoke tests need it too; it changes no data.
setup(
  "sign in with the test account",
  { tag: "@smoke" },
  async ({ page, baseURL }) => {
    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    if (!username || !password) {
      throw new Error(
        "E2E needs a test account without MFA: set E2E_USERNAME and E2E_PASSWORD.",
      );
    }

    const login = new LoginPage(page);
    await login.goto();
    await login.signInButton.click();
    await new MicrosoftSignInPage(page).signIn(
      username,
      password,
      new URL(baseURL!).origin,
    );

    await expect(new AppShell(page).signOutButton).toBeVisible();
    await page.context().storageState({ path: SIGNED_IN_STATE });
  },
);
