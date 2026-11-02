// A signed-in user for tests, in Auth.js's session cookie. The cookie is
// encrypted with testEnv.AUTH_SECRET, so the code under test needs
// stubServerEnv() to read it.

import { decode, encode } from "next-auth/jwt";
import type { SessionToken } from "@/lib/auth/tokens";
import { testEnv } from "./env";

/** The session cookie's name when AUTH_URL is http, as in tests. */
export const SESSION_COOKIE = "authjs.session-token";

export const sessionFixture: SessionToken = {
  sub: "oid-1",
  name: "Ada Lovelace",
  email: "ada@contoso.example",
  accessToken: "fake-access-token-0",
  accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  refreshToken: "fake-refresh-token-0",
};

/** A signed-in browser's cookies, for setRequestCookies(). */
export async function signedInCookies(
  token: SessionToken = sessionFixture,
): Promise<Record<string, string>> {
  const value = await encode({
    token,
    secret: testEnv.AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
  return { [SESSION_COOKIE]: value };
}

/** Decrypts a session cookie's value. */
export function readSessionCookie(value: string) {
  return decode({
    token: value,
    secret: testEnv.AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
}
