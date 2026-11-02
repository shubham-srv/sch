import type { Locator, Page } from "@playwright/test";

// Microsoft's own sign-in screens (login.microsoftonline.com). Microsoft can
// change their wording; the locators below match it at the time of writing.
// The test account must not need MFA.
export class MicrosoftSignInPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly nextButton: Locator;
  readonly signInButton: Locator;
  readonly staySignedInNo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByRole("textbox", { name: /email/i });
    this.password = page.getByLabel(/password/i);
    this.nextButton = page.getByRole("button", { name: "Next" });
    this.signInButton = page.getByRole("button", { name: "Sign in" });
    this.staySignedInNo = page.getByRole("button", { name: "No" });
  }

  /** Signs in and waits until Microsoft has sent the browser back to `appOrigin`. */
  async signIn(username: string, password: string, appOrigin: string) {
    await this.email.fill(username);
    await this.nextButton.click();
    await this.password.fill(password);
    await this.signInButton.click();

    // "Stay signed in?" appears unless the tenant has turned it off.
    const backInApp = this.page.waitForURL((url) => url.origin === appOrigin);
    const prompt = this.staySignedInNo
      .waitFor({ timeout: 15_000 })
      .then(() => this.staySignedInNo.click())
      .catch(() => {});
    await Promise.race([backInApp, prompt]);
    await backInApp;
  }
}
