import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getApiClient } from "@/lib/api/server";
import { getGreeting } from "./queries";

vi.mock("@/lib/api/server", () => ({ getApiClient: vi.fn() }));

function stubClient(result: Promise<unknown>) {
  const GET = vi.fn().mockReturnValue(result);
  vi.mocked(getApiClient).mockResolvedValue({ GET } as unknown as ApiClient);
  return GET;
}

describe("getGreeting", () => {
  it("requests /greeting and maps the response", async () => {
    const GET = stubClient(
      Promise.resolve({
        data: { message: "hello world" },
        response: new Response(null, { status: 200 }),
      }),
    );

    await expect(getGreeting()).resolves.toEqual({ message: "hello world" });
    expect(GET).toHaveBeenCalledWith("/greeting");
  });

  it("throws ApiError when the backend call fails", async () => {
    stubClient(
      Promise.resolve({
        error: { title: "Internal Server Error", status: 500 },
        response: new Response(null, { status: 500 }),
      }),
    );

    await expect(getGreeting()).rejects.toBeInstanceOf(ApiError);
  });
});
