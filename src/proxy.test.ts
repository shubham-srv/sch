import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { encode } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionToken } from "@/lib/auth/tokens";
import { config, proxy } from "./proxy";

// Renewal against Entra is covered in tests/integration/auth.int.test.ts.

const env = {
  API_BASE_URL: "http://backend.test/api",
  AUTH_URL: "http://localhost:3000",
  AUTH_SECRET: "a".repeat(32),
  AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
  AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
  AUTH_MICROSOFT_ENTRA_ID_ISSUER:
    "https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0",
  ENTRA_API_SCOPE: "api://backend-id/access_scan",
};

// Auth.js's cookie name over http.
const SESSION_COOKIE = "authjs.session-token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const freshToken: SessionToken = {
  sub: "oid-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  accessToken: "access-token",
  accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  refreshToken: "refresh-token",
};

async function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, env.AUTH_URL), {
    headers: cookie ? { cookie } : {},
  });
}

async function sessionCookie(token: SessionToken) {
  const value = await encode({
    token,
    secret: env.AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
  return `${SESSION_COOKIE}=${value}`;
}

// The session cookie the response sets, parsed.
function setSessionCookie(response: Response) {
  return new NextResponse(null, { headers: response.headers }).cookies.get(
    SESSION_COOKIE,
  );
}

function passesThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it.each(["/login", "/auth/signout"])(
    "lets %s through without a session",
    async (path) => {
      expect(passesThrough(await proxy(await request(path)))).toBe(true);
    },
  );

  it("sends a signed-out user to the login page with the requested path", async () => {
    const response = await proxy(await request("/reports?tab=2"));

    expect(getRedirectUrl(response)).toBe(
      "http://localhost:3000/login?next=%2Freports%3Ftab%3D2",
    );
  });

  it("leaves out next for the home page", async () => {
    const response = await proxy(await request("/"));

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/login");
  });

  it("deletes an unreadable session cookie on the way to the login page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await proxy(
      await request("/", `${SESSION_COOKIE}=garbage`),
    );

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/login");
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringMatching(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`)),
    );
  });

  it("lets a signed-in user through and keeps the session for seven more days", async () => {
    const response = await proxy(
      await request("/reports", await sessionCookie(freshToken)),
    );

    expect(passesThrough(response)).toBe(true);
    const cookie = setSessionCookie(response);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax" });
    expect(cookie?.expires?.valueOf()).toBeGreaterThan(
      Date.now() + SEVEN_DAYS_MS - 60_000,
    );
    // The forwarded request carries the rewritten cookie.
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      cookie?.value,
    );
  });
});

describe("proxy matcher", () => {
  it.each(["/", "/reports", "/login", "/auth/signout", "/api/healthy"])(
    "runs for %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/api/health",
    "/api/auth/session",
    "/api/auth/callback/microsoft-entra-id",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/robots.txt",
  ])("skips %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
