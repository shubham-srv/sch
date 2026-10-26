import { expect, test } from "@playwright/test";
import { HelloPage } from "../pages/hello.page";

// The greeting comes from a real backend, so its text depends on the
// environment. Set E2E_EXPECTED_GREETING to check it exactly.
const expectedGreeting = process.env.E2E_EXPECTED_GREETING;

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

    await expect(hello.headings).toHaveCount(1);
    if (expectedGreeting) {
      await expect(hello.greeting(expectedGreeting)).toBeVisible();
    } else {
      await expect(hello.headings).not.toBeEmpty();
    }
    // The error page also has an h1, so make sure this is not it.
    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toHaveCount(0);
    // The layout's "%s | Web" template applies to child segments only.
    await expect(page).toHaveTitle("Hello world");
    expect(errors).toEqual([]);
  },
);
