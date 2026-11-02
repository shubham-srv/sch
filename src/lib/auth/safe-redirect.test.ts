import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each(["/", "/reports", "/reports?page=2&sort=name", "/reports#top"])(
    "accepts the path %j",
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it.each([
    ["an absolute URL", "https://evil.example/"],
    ["a protocol-relative URL", "//evil.example/"],
    ["a backslash after the slash", "/\\evil.example/"],
    ["a backslash later on", "/reports\\..\\..\\evil"],
    ["a tab between the slashes", "/\t/evil.example/"],
    ["a newline", "/reports\n"],
    ["a relative path", "reports"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["an empty string", ""],
    ["a very long path", `/${"a".repeat(2048)}`],
  ])("falls back to / for %s", (_case, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it.each([undefined, null, 42, ["/reports"]])(
    "falls back to / for the non-string %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );

  it("normalises dot segments without leaving the site", () => {
    expect(safeNextPath("/a/../b")).toBe("/b");
  });
});
