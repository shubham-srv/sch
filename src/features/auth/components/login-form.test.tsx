import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithMicrosoft } from "@/features/auth/api/actions";
import { LoginForm } from "./login-form";

vi.mock("@/features/auth/api/actions", () => ({
  signInWithMicrosoft: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(signInWithMicrosoft).mockReset();
});

describe("LoginForm", () => {
  it("starts the sign-in with the path to return to", async () => {
    render(<LoginForm next="/reports?tab=2" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Sign in with Microsoft" }),
    );

    expect(signInWithMicrosoft).toHaveBeenCalledOnce();
    const form = vi.mocked(signInWithMicrosoft).mock.calls[0]![0];
    expect(form.get("next")).toBe("/reports?tab=2");
  });

  it("returns to the home page by default", () => {
    render(<LoginForm />);

    expect(screen.getByRole("form", { name: "Sign in" })).toHaveFormValues({
      next: "/",
    });
  });
});
