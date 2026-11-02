import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { signOutOfApp } from "@/features/auth/api/actions";
import { UserMenu } from "./user-menu";

vi.mock("@/features/auth/api/actions", () => ({ signOutOfApp: vi.fn() }));

const user = { name: "Ada Lovelace", email: "ada@example.com" };

describe("UserMenu", () => {
  it("shows the user's name", () => {
    render(<UserMenu user={user} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("signs out with the Sign out button", async () => {
    render(<UserMenu user={user} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOutOfApp).toHaveBeenCalledOnce();
  });
});
