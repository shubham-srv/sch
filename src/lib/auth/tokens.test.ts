import type { Account } from "next-auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jwt, session, type SessionToken } from "./tokens";

// Renewal against Entra is covered in tests/integration/auth.int.test.ts.

const inAnHour = Math.floor(Date.now() / 1000) + 3600;

const stored: SessionToken = {
  sub: "oid-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  accessToken: "access-token-0",
  accessTokenExpiresAt: inAnHour,
  refreshToken: "refresh-token-0",
};

// What Auth.js passes at sign-in: profile() made the token's name and email,
// and the account holds Entra's token response.
const signInToken = {
  sub: "random-id-from-auth-js",
  name: "Ada Lovelace",
  email: "ada@example.com",
  picture: null,
};
const account: Account = {
  provider: "microsoft-entra-id",
  type: "oidc",
  providerAccountId: "oid-1",
  access_token: "access-token-1",
  expires_at: inAnHour,
  refresh_token: "refresh-token-1",
  id_token: "header.payload.signature",
  token_type: "bearer",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("jwt", () => {
  it("keeps the user and Entra's tokens at sign-in, and not the ID token", async () => {
    await expect(jwt({ token: signInToken, account })).resolves.toEqual({
      sub: "oid-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      accessToken: "access-token-1",
      accessTokenExpiresAt: inAnHour,
      refreshToken: "refresh-token-1",
    });
  });

  it("fails the sign-in when Entra sent no refresh token", async () => {
    await expect(
      jwt({
        token: signInToken,
        account: { ...account, refresh_token: undefined },
      }),
    ).rejects.toThrow();
  });

  it("keeps a fresh token without calling Entra", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");

    await expect(
      jwt({ token: { ...stored, iat: 1, exp: 2, jti: "id" } }),
    ).resolves.toEqual(stored);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs out a cookie in another shape", async () => {
    await expect(
      jwt({ token: { sub: "oid-1", name: "Ada Lovelace" } }),
    ).resolves.toBeNull();
  });
});

describe("session", () => {
  it("exposes the user's name and email, never the tokens", () => {
    const expires = "2026-11-09T12:00:00.000Z";

    expect(
      session({
        session: { expires, user: { name: null, email: null, image: null } },
        token: stored,
      }),
    ).toEqual({
      expires,
      user: { name: "Ada Lovelace", email: "ada@example.com" },
    });
  });
});
