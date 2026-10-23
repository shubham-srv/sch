import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GreetingHeading } from "./greeting-heading";

it("renders the message as the level-1 heading", () => {
  render(<GreetingHeading message="hello world" />);

  expect(
    screen.getByRole("heading", { level: 1, name: "hello world" }),
  ).toBeInTheDocument();
});
