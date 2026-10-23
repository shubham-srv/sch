import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test gets a fresh module so the cached config does not leak between tests.
const loadEnvModule = () => import("./env.server");

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("does not validate when the module is imported", async () => {
    vi.stubEnv("API_BASE_URL", undefined);

    await expect(loadEnvModule()).resolves.toHaveProperty("getServerEnv");
  });

  it.each([
    "https://backend.example.com/api",
    "http://localhost:4010",
    "http://127.0.0.1:4010",
    "http://mock-api:4010",
  ])("accepts %s", async (value) => {
    vi.stubEnv("API_BASE_URL", value);
    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual({ API_BASE_URL: value });
  });

  it("throws a clear error on first access when API_BASE_URL is missing", async () => {
    vi.stubEnv("API_BASE_URL", undefined);
    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow(
      /Invalid server environment variables[\s\S]*API_BASE_URL/,
    );
  });

  it.each(["not a url", "ftp://backend.example.com"])(
    "throws a clear error when API_BASE_URL is %j",
    async (value) => {
      vi.stubEnv("API_BASE_URL", value);
      const { getServerEnv } = await loadEnvModule();

      expect(() => getServerEnv()).toThrow(/API_BASE_URL/);
    },
  );
});
