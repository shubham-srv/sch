import { expect, test } from "@playwright/test";
import { HelloPage } from "../pages/hello.page";

// Against a real backend the greeting can differ; the smoke run sets this.
const expectedGreeting = process.env.SMOKE_EXPECTED_GREETING ?? "hello world";

test(
  "shows the backend greeting as the page heading",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const hello = new HelloPage(page);
    await hello.goto();

    await expect(hello.greeting(expectedGreeting)).toBeVisible();
    await expect(hello.headings).toHaveCount(1);
    // The layout's "%s | Web" template applies to child segments only.
    await expect(page).toHaveTitle("Hello world");
    expect(errors).toEqual([]);
  },
);
