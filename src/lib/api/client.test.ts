import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import { ApiError } from "./errors";

function stubFetch(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

describe("createApiClient", () => {
  it("appends the path to a base URL with a trailing slash", async () => {
    const fetch = stubFetch(Response.json({ ok: true }));
    const client = createApiClient({
      baseUrl: "https://backend.example.com/api/",
      fetch,
    });

    await client.get("/greeting");

    expect(fetch.mock.calls[0]?.[0]).toBe(
      "https://backend.example.com/api/greeting",
    );
  });

  it("resolves to the parsed JSON body", async () => {
    const client = createApiClient({
      baseUrl: "https://backend.example.com",
      fetch: stubFetch(Response.json({ message: "hi" })),
    });

    await expect(client.get("/greeting")).resolves.toEqual({ message: "hi" });
  });

  it("resolves to undefined for an empty body", async () => {
    const client = createApiClient({
      baseUrl: "https://backend.example.com",
      fetch: stubFetch(new Response(null, { status: 204 })),
    });

    await expect(client.get("/greeting")).resolves.toBeUndefined();
  });

  it("rejects with ApiError when the error body is not JSON", async () => {
    const client = createApiClient({
      baseUrl: "https://backend.example.com",
      fetch: stubFetch(
        new Response("<html>Bad Gateway</html>", { status: 502 }),
      ),
    });

    const error = await client.get("/greeting").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
  });

  it("replaces an invalid incoming correlation id", async () => {
    const fetch = stubFetch(Response.json({}));
    const client = createApiClient({
      baseUrl: "https://backend.example.com",
      correlationId: "not valid\nid",
      fetch,
    });

    await client.get("/greeting");

    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get("X-Correlation-Id")).not.toBe("not valid\nid");
    expect(headers.get("X-Correlation-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
