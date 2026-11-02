import "server-only";
import { headers } from "next/headers";
import NextAuth, { type NextAuthConfig } from "next-auth";
import { getToken } from "next-auth/jwt";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { LOGIN_PATH } from "@/lib/auth/paths";
import {
  jwt,
  readSessionToken,
  session,
  SESSION_MAX_AGE_SECONDS,
  signInScope,
} from "@/lib/auth/tokens";
import { getServerEnv, type ServerEnv } from "@/lib/env.server";

// Auth.js (NextAuth v5) runs the sign-in with Microsoft Entra ID and keeps the
// session in an encrypted cookie. Its own routes are under /api/auth.

function authConfig(env: ServerEnv): NextAuthConfig {
  return {
    secret: env.AUTH_SECRET,
    providers: [
      MicrosoftEntraID({
        clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        authorization: { params: { scope: signInScope(env) } },
        checks: ["pkce", "state", "nonce"],
        // Replaces the default, which also fetches the user's photo from
        // Microsoft Graph: the access token is for the backend, not Graph.
        profile: (claims) => ({
          id: claims.oid,
          name: claims.name,
          email: claims.preferred_username,
        }),
      }),
    ],
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    useSecureCookies: usesSecureCookies(env),
    // No error page: a failed sign-in returns to the login page. Auth.js logs
    // the reason on the server.
    pages: { signIn: LOGIN_PATH, error: LOGIN_PATH },
    callbacks: { jwt, session },
  };
}

// Built per call, so the environment is read at request time and never during
// `next build`.
export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  authConfig(getServerEnv()),
);

/**
 * The signed-in user's access token for the backend, or null without a
 * session. Server only: it must never reach the browser.
 */
export async function getAccessToken(): Promise<string | null> {
  const env = getServerEnv();
  const token = await getToken({
    // Only the cookie: getToken would also take an Authorization header.
    req: { headers: { cookie: (await headers()).get("cookie") ?? "" } },
    secret: env.AUTH_SECRET,
    secureCookie: usesSecureCookies(env),
  });
  return readSessionToken(token)?.accessToken ?? null;
}

function usesSecureCookies(env: ServerEnv) {
  return new URL(env.AUTH_URL).protocol === "https:";
}
