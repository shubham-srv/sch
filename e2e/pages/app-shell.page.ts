import type { Locator, Page } from "@playwright/test";

/** The top bar and sidebar around every signed-in page. */
export class AppShell {
  readonly page: Page;
  readonly topbar: Locator;
  readonly navigation: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.topbar = page.getByRole("banner");
    this.navigation = page.getByRole("navigation", { name: "Main" });
    this.signOutButton = this.topbar.getByRole("button", { name: "Sign out" });
  }

  userName(name: string): Locator {
    return this.topbar.getByText(name, { exact: true });
  }
}
