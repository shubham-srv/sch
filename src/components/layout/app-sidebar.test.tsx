import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AppSidebar } from "./app-sidebar";

it("is the main navigation with a link to the home page", () => {
  render(<AppSidebar />);

  const nav = screen.getByRole("navigation", { name: "Main" });
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
});
