import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: "Sign in" });
    this.signInButton = page.getByRole("button", {
      name: "Sign in with Microsoft",
    });
  }

  async goto() {
    await this.page.goto("/login");
  }
}
