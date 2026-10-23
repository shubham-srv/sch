import { expect, test } from "@playwright/test";

test.describe("/api/health", { tag: "@smoke" }, () => {
  test("reports ok", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("carries the security headers", async ({ request }) => {
    const headers = (await request.get("/api/health")).headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
