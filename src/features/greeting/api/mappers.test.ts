import { describe, expect, it } from "vitest";
import { toGreeting } from "./mappers";

describe("toGreeting", () => {
  it("maps a valid payload to the UI model", () => {
    expect(toGreeting({ message: "hello world" })).toEqual({
      message: "hello world",
    });
  });

  it.each([
    ["missing", {}],
    ["not a string", { message: 42 }],
  ])("throws a clear error when message is %s", (_case, dto) => {
    expect(() => toGreeting(dto)).toThrow(
      /Unexpected greeting response from the backend[\s\S]*message/,
    );
  });

  it("throws a clear error when the payload is not an object", () => {
    expect(() => toGreeting(undefined)).toThrow(
      "Unexpected greeting response from the backend",
    );
  });
});
