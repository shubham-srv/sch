import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorView } from "./error-view";

const rawError = Object.assign(
  new Error("connect ECONNREFUSED 10.0.0.5:8080"),
  { digest: "2941087651" },
);

describe("ErrorView", () => {
  it("announces a generic message in an alert", () => {
    render(<ErrorView error={rawError} onRetry={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("We couldn't load this page.");
  });

  it("never shows the raw error", () => {
    render(<ErrorView error={rawError} onRetry={vi.fn()} />);

    expect(document.body).not.toHaveTextContent("ECONNREFUSED");
    expect(document.body).not.toHaveTextContent("10.0.0.5");
  });

  it("shows the error digest as a reference", () => {
    render(<ErrorView error={rawError} onRetry={vi.fn()} />);

    expect(screen.getByText("Reference: 2941087651")).toBeInTheDocument();
  });

  it("calls onRetry once when the retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorView error={rawError} onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
