import "server-only";
import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";
import { getServerEnv, type ServerEnv } from "@/lib/env.server";

// What the session cookie holds, and the renewal of its access token.
// src/lib/auth/auth.ts hands these to Auth.js as its `jwt` and `session`
// callbacks; Auth.js encrypts the cookie.

/**
 * How long the session cookie lives after it was last written. Auth.js
 * rewrites it whenever the proxy reads the session, so the session ends after
 * this long without a visit.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** The access token is renewed when less than this is left. */
const RENEW_BEFORE_SECONDS = 5 * 60;

const sessionTokenSchema = z.object({
  /** The user's Entra object id (`oid`). */
  sub: z.string().min(1),
  name: z.string(),
  /** `preferred_username`: the address the user signs in with. */
  email: z.string(),
  accessToken: z.string().min(1),
  /** Epoch seconds. */
  accessTokenExpiresAt: z.number(),
  refreshToken: z.string().min(1),
});

/** What the session cookie holds. The ID token is not kept. */
export type SessionToken = z.infer<typeof sessionTokenSchema>;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
  refresh_token: z.string().min(1).optional(),
});

/** The decrypted session cookie as this app wrote it, or null. */
export function readSessionToken(token: unknown): SessionToken | null {
  const result = sessionTokenSchema.safeParse(token);
  return result.success ? result.data : null;
}

/**
 * The scopes requested at sign-in and renewal. offline_access returns a
 * refresh token; the API scope makes the access token one the backend accepts.
 */
export function signInScope(env: ServerEnv): string {
  return `openid profile offline_access ${env.ENTRA_API_SCOPE}`;
}

/**
 * Auth.js's `jwt` callback, run whenever the session is read. At sign-in it
 * keeps the tokens Entra returned; afterwards it renews the access token when
 * it is about to expire. Returning null deletes the cookie: signed out.
 */
export async function jwt({
  token,
  account,
}: {
  token: JWT;
  account?: Account | null;
}): Promise<SessionToken | null> {
  if (account) {
    // Throws, failing the sign-in, if Entra sent no refresh token.
    return sessionTokenSchema.parse({
      // Without a database, Auth.js gives the user a random id; the id from
      // profile() (the oid) is the account's providerAccountId.
      sub: account.providerAccountId,
      name: token.name,
      email: token.email,
      accessToken: account.access_token,
      accessTokenExpiresAt: account.expires_at,
      refreshToken: account.refresh_token,
    });
  }

  // Null for a cookie in another shape, e.g. one an older version wrote.
  const current = readSessionToken(token);
  if (!current || !needsRenewal(current)) return current;
  try {
    return await renewTokens(current);
  } catch (error) {
    console.error("Token renewal failed; signing out:", String(error));
    return null;
  }
}

/**
 * Auth.js's `session` callback: what `auth()` returns, and what Auth.js's
 * /api/auth/session endpoint sends to the browser. Never add tokens here.
 */
export function session({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}): Session {
  return {
    expires: session.expires,
    user: { name: token.name, email: token.email },
  };
}

function needsRenewal(token: SessionToken) {
  return token.accessTokenExpiresAt - Date.now() / 1000 < RENEW_BEFORE_SECONDS;
}

/** A copy of `token` with tokens renewed by Entra. Throws when Entra refuses. */
async function renewTokens(token: SessionToken): Promise<SessionToken> {
  const env = getServerEnv();
  const response = await fetch(tokenEndpoint(env), {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      client_secret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      refresh_token: token.refreshToken,
      scope: signInScope(env),
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Entra's error and error_description; neither contains a token.
    const { error, error_description } = (body ?? {}) as Record<
      string,
      unknown
    >;
    throw new Error(
      `Entra answered ${response.status}: ${String(error)} ${String(error_description)}`,
    );
  }

  const tokens = tokenResponseSchema.parse(body);
  return {
    ...token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    // Entra normally sends a new refresh token; if not, the old one stays valid.
    refreshToken: tokens.refresh_token ?? token.refreshToken,
  };
}

// The issuer is https://login.microsoftonline.com/<tenant-id>/v2.0 (checked
// in env.server.ts), and a tenant's token endpoint is fixed and documented.
function tokenEndpoint(env: ServerEnv) {
  return env.AUTH_MICROSOFT_ENTRA_ID_ISSUER.replace(
    /\/v2\.0$/,
    "/oauth2/v2.0/token",
  );
}
