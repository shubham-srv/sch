import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test gets a fresh module so the cached config does not leak between tests.
const loadEnvModule = () => import("./env.server");

const validEnv = {
  API_BASE_URL: "https://backend.example.com/api",
  AUTH_URL: "https://app.example.com",
  AUTH_SECRET: "x".repeat(32),
  AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
  AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
  AUTH_MICROSOFT_ENTRA_ID_ISSUER:
    "https://login.microsoftonline.com/0b9c4a39-4e1f-4c32-8f0a-1d2e3f4a5b6c/v2.0",
  ENTRA_API_SCOPE: "api://backend-id/access_scan",
};

beforeEach(() => {
  vi.resetModules();
  for (const [name, value] of Object.entries(validEnv)) {
    vi.stubEnv(name, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("does not validate when the module is imported", async () => {
    vi.stubEnv("API_BASE_URL", undefined);

    await expect(loadEnvModule()).resolves.toHaveProperty("getServerEnv");
  });

  it("returns every variable when all are valid", async () => {
    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual(validEnv);
  });

  it.each([
    "https://backend.example.com/api",
    "http://localhost:4010",
    "http://127.0.0.1:4010",
    "http://backend:8080",
  ])("accepts %s as API_BASE_URL", async (value) => {
    vi.stubEnv("API_BASE_URL", value);
    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv().API_BASE_URL).toBe(value);
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

  it.each([
    "AUTH_URL",
    "AUTH_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_ID",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
    "ENTRA_API_SCOPE",
  ])("throws a clear error when %s is missing", async (name) => {
    vi.stubEnv(name, undefined);
    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow(new RegExp(name));
  });

  it("rejects an AUTH_SECRET shorter than 32 characters", async () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(31));
    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow(/AUTH_SECRET/);
  });

  // A path would become the base path of Auth.js's routes.
  it("rejects an AUTH_URL with a path", async () => {
    vi.stubEnv("AUTH_URL", "https://app.example.com/web");
    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow(/AUTH_URL/);
  });

  it.each([
    "https://login.microsoftonline.com/common/v2.0",
    "https://login.microsoftonline.com/organizations/v2.0",
    "https://login.microsoftonline.com/0b9c4a39-4e1f-4c32-8f0a-1d2e3f4a5b6c",
  ])(
    "rejects %s as AUTH_MICROSOFT_ENTRA_ID_ISSUER: only one tenant's v2.0 issuer",
    async (value) => {
      vi.stubEnv("AUTH_MICROSOFT_ENTRA_ID_ISSUER", value);
      const { getServerEnv } = await loadEnvModule();

      expect(() => getServerEnv()).toThrow(/AUTH_MICROSOFT_ENTRA_ID_ISSUER/);
    },
  );
});
