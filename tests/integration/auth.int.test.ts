// @vitest-environment node
// Auth.js's route handlers and the proxy read a NextRequest, which needs
// Node's Request rather than jsdom's.
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithMicrosoft, signOutOfApp } from "@/features/auth/api/actions";
import { handlers } from "@/lib/auth/auth";
import type { SessionToken } from "@/lib/auth/tokens";
import { proxy } from "@/proxy";
import {
  entraAuthorizeUrl,
  entraTokenUrl,
  signInAtEntra,
} from "../mocks/handlers";
import { server } from "../mocks/server";
import { stubServerEnv, testEnv } from "../utils/env";
import {
  getSetCookies,
  setRequestCookies,
  setRequestHeaders,
} from "../utils/next-headers";
import { RedirectError } from "../utils/next-navigation";
import {
  readSessionCookie,
  SESSION_COOKIE,
  sessionFixture,
  signedInCookies,
} from "../utils/session";

vi.mock("next/headers", () => import("../utils/next-headers"));
vi.mock("next/navigation", () => import("../utils/next-navigation"));

const { AUTH_URL } = testEnv;
const CALLBACK_URL = `${AUTH_URL}/api/auth/callback/microsoft-entra-id`;

function cookieHeader(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** The value of a cookie the response sets, or undefined. */
function setCookieValue(response: Response, name: string) {
  const cookie = response.headers
    .getSetCookie()
    .find((header) => header.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1).split(";")[0];
}

function captureTokenRequest() {
  const captured: { body?: URLSearchParams; headers?: Headers } = {};
  server.events.on("request:start", async ({ request }) => {
    if (request.url === entraTokenUrl) {
      captured.body = new URLSearchParams(await request.clone().text());
      captured.headers = request.headers;
    }
  });
  return captured;
}

/** Submits the login form; returns Microsoft's sign-in URL. */
async function submitLoginForm(next: string) {
  const form = new FormData();
  form.set("next", next);
  const error = await signInWithMicrosoft(form).catch((e: unknown) => e);
  if (!(error instanceof RedirectError)) throw error;
  return new URL(error.url);
}

/** Microsoft sends the browser back, with the cookies the sign-in set. */
function returnFromMicrosoft(query: string) {
  const cookies = Object.fromEntries(
    getSetCookies().map(({ name, value }) => [name, value]),
  );
  return handlers.GET(
    new NextRequest(`${CALLBACK_URL}?${query}`, {
      headers: { cookie: cookieHeader(cookies) },
    }),
  );
}

async function signInAndReturn(next: string) {
  const url = await submitLoginForm(next);
  const state = url.searchParams.get("state");
  return returnFromMicrosoft(`code=${signInAtEntra(url)}&state=${state}`);
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stubServerEnv();
  setRequestHeaders();
  setRequestCookies();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  server.events.removeAllListeners();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("signing in", () => {
  it("sends the browser to Microsoft for the backend's scope, with PKCE", async () => {
    const url = await submitLoginForm("/reports");

    expect(`${url.origin}${url.pathname}`).toBe(entraAuthorizeUrl);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: testEnv.AUTH_MICROSOFT_ENTRA_ID_ID,
      response_type: "code",
      redirect_uri: CALLBACK_URL,
      scope: `openid profile offline_access ${testEnv.ENTRA_API_SCOPE}`,
      code_challenge_method: "S256",
      state: expect.any(String),
      nonce: expect.any(String),
    });
    // The values Microsoft's answer must match wait in HttpOnly cookies.
    expect(getSetCookies().length).toBeGreaterThan(0);
    for (const { options } of getSetCookies()) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
    }
  });

  it("returns to the requested page with a session holding the tokens", async () => {
    const tokenRequest = captureTokenRequest();

    const response = await signInAndReturn("/reports?tab=2");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${AUTH_URL}/reports?tab=2`);
    const token = await readSessionCookie(
      setCookieValue(response, SESSION_COOKIE)!,
    );
    expect(token).toMatchObject({
      sub: "oid-1",
      name: "Ada Lovelace",
      email: "ada@contoso.example",
      accessToken: "fake-access-token-1",
      refreshToken: "fake-refresh-token-1",
    });
    expect(token).not.toHaveProperty("id_token");
    expect(Object.fromEntries(tokenRequest.body!)).toMatchObject({
      grant_type: "authorization_code",
      code: "code-1",
      redirect_uri: CALLBACK_URL,
      code_verifier: expect.any(String),
    });
  });

  it("returns to the home page instead of another site", async () => {
    const response = await signInAndReturn("//evil.example/");

    expect(response.headers.get("location")).toBe(`${AUTH_URL}/`);
  });

  it("returns to the login page when Entra reports an error", async () => {
    const url = await submitLoginForm("/");

    const response = await returnFromMicrosoft(
      `error=access_denied&error_description=denied&state=${url.searchParams.get("state")}`,
    );

    expect(response.headers.get("location")).toMatch(
      new RegExp(`^${AUTH_URL}/login\\b`),
    );
    expect(setCookieValue(response, SESSION_COOKIE)).toBeUndefined();
  });

  it("returns to the login page when the state does not match", async () => {
    const url = await submitLoginForm("/");

    const response = await returnFromMicrosoft(
      `code=${signInAtEntra(url)}&state=someone-elses`,
    );

    expect(response.headers.get("location")).toMatch(
      new RegExp(`^${AUTH_URL}/login\\b`),
    );
    expect(setCookieValue(response, SESSION_COOKIE)).toBeUndefined();
  });

  it("returns to the login page when Entra refuses the code", async () => {
    server.use(
      http.post(entraTokenUrl, () =>
        HttpResponse.json(
          {
            error: "invalid_grant",
            error_description: "AADSTS70008: The provided code has expired.",
          },
          { status: 400 },
        ),
      ),
    );

    const response = await signInAndReturn("/");

    expect(response.headers.get("location")).toMatch(
      new RegExp(`^${AUTH_URL}/login\\b`),
    );
    expect(setCookieValue(response, SESSION_COOKIE)).toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

describe("renewing the access token in the proxy", () => {
  const expiringSoon: SessionToken = {
    ...sessionFixture,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 60,
  };

  async function proxyRequest(token: SessionToken) {
    const request = new NextRequest(`${AUTH_URL}/reports`, {
      headers: { cookie: cookieHeader(await signedInCookies(token)) },
    });
    return proxy(request);
  }

  it("swaps in new tokens from Entra for this request and the browser", async () => {
    const tokenRequest = captureTokenRequest();

    const response = await proxyRequest(expiringSoon);

    const cookie = setCookieValue(response, SESSION_COOKIE)!;
    await expect(readSessionCookie(cookie)).resolves.toMatchObject({
      sub: "oid-1",
      accessToken: "fake-access-token-2",
      refreshToken: "fake-refresh-token-2",
    });
    // The forwarded request carries the new cookie, so this render uses it.
    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      cookie,
    );
    expect(Object.fromEntries(tokenRequest.body!)).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: sessionFixture.refreshToken,
      scope: `openid profile offline_access ${testEnv.ENTRA_API_SCOPE}`,
      client_id: testEnv.AUTH_MICROSOFT_ENTRA_ID_ID,
      client_secret: testEnv.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    });
  });

  it("does not call Entra while the token is fresh", async () => {
    const tokenRequest = captureTokenRequest();

    await proxyRequest(sessionFixture);

    expect(tokenRequest.body).toBeUndefined();
  });

  it.each([
    [
      "refuses the refresh token",
      () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
    ],
    ["cannot be reached", () => HttpResponse.error()],
  ])("signs the user out when Entra %s", async (_case, resolver) => {
    server.use(http.post(entraTokenUrl, resolver));

    const response = await proxyRequest(expiringSoon);

    expect(response.headers.get("location")).toBe(
      `${AUTH_URL}/login?next=%2Freports`,
    );
    expect(setCookieValue(response, SESSION_COOKIE)).toBe("");
    expect(logged).toHaveBeenCalledWith(
      "Token renewal failed; signing out:",
      expect.any(String),
    );
  });
});

describe("signing out", () => {
  it("deletes the session cookie and goes to the login page", async () => {
    setRequestCookies(await signedInCookies());

    const error = await signOutOfApp().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RedirectError);
    expect(error).toMatchObject({ url: `${AUTH_URL}/login` });
    expect(getSetCookies()).toContainEqual(
      expect.objectContaining({
        name: SESSION_COOKIE,
        value: "",
        options: expect.objectContaining({ maxAge: 0 }),
      }),
    );
  });
});
