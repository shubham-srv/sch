import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppTopbar } from "./app-topbar";

describe("AppTopbar", () => {
  it("is the page banner with the app name", () => {
    render(<AppTopbar />);

    expect(screen.getByRole("banner")).toHaveTextContent("Web");
  });

  it("shows the user menu it is given", () => {
    render(<AppTopbar userMenu={<button type="button">Sign out</button>} />);

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
