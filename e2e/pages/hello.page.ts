import type { Locator, Page } from "@playwright/test";

export class HelloPage {
  readonly page: Page;
  readonly headings: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headings = page.getByRole("heading", { level: 1 });
  }

  async goto() {
    await this.page.goto("/");
  }

  greeting(text: string): Locator {
    return this.page.getByRole("heading", {
      level: 1,
      name: text,
      exact: true,
    });
  }
}
