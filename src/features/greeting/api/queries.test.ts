import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getApiClient } from "@/lib/api/server";
import { getGreeting } from "./queries";

vi.mock("@/lib/api/server", () => ({ getApiClient: vi.fn() }));

function stubClient(get: ApiClient["get"]) {
  const client = { get: vi.fn(get), request: vi.fn() };
  vi.mocked(getApiClient).mockResolvedValue(client);
  return client;
}

describe("getGreeting", () => {
  it("requests /greeting and maps the response", async () => {
    const client = stubClient(async () => ({ message: "hello world" }));

    await expect(getGreeting()).resolves.toEqual({ message: "hello world" });
    expect(client.get).toHaveBeenCalledWith("/greeting");
  });

  it("throws ApiError when the backend call fails", async () => {
    stubClient(async () => {
      throw new ApiError({ status: 500, title: "Internal Server Error" });
    });

    await expect(getGreeting()).rejects.toBeInstanceOf(ApiError);
  });
});
