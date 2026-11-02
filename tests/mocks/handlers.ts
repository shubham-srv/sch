import { generateKeyPair, SignJWT } from "jose";
import { http, HttpResponse } from "msw";
import { testEnv } from "../utils/env";

// The fake backend and the fake Microsoft Entra ID for Vitest (through MSW's
// setupServer). Defaults are the happy path; a test puts the UI into another
// state (error, empty, slow) by overriding a handler with server.use(...).
// E2E tests use a real backend and real Entra ID.

export const greetingFixture = { message: "hello world" };

/** What the fake Entra puts in the ID token at sign-in. */
export const entraFixture = {
  claims: {
    oid: "oid-1",
    name: "Ada Lovelace",
    preferred_username: "ada@contoso.example",
  },
};

const issuer = testEnv.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
const tenantId = issuer.split("/")[3]!;
const authority = `https://login.microsoftonline.com/${tenantId}`;

export const entraAuthorizeUrl = `${authority}/oauth2/v2.0/authorize`;
export const entraTokenUrl = `${authority}/oauth2/v2.0/token`;

// A tenant's discovery document, as Entra serves it (trimmed).
const entraDiscovery = {
  issuer,
  authorization_endpoint: entraAuthorizeUrl,
  token_endpoint: entraTokenUrl,
  token_endpoint_auth_methods_supported: [
    "client_secret_post",
    "private_key_jwt",
    "client_secret_basic",
  ],
  jwks_uri: `${authority}/discovery/v2.0/keys`,
  userinfo_endpoint: "https://graph.microsoft.com/oidc/userinfo",
  end_session_endpoint: `${authority}/oauth2/v2.0/logout`,
  response_modes_supported: ["query", "fragment", "form_post"],
  response_types_supported: [
    "code",
    "id_token",
    "code id_token",
    "id_token token",
  ],
  scopes_supported: ["openid", "profile", "email", "offline_access"],
  subject_types_supported: ["pairwise"],
  id_token_signing_alg_values_supported: ["RS256"],
  claims_supported: [
    "sub",
    "iss",
    "aud",
    "exp",
    "iat",
    "auth_time",
    "nonce",
    "preferred_username",
    "name",
    "tid",
    "ver",
    "oid",
  ],
};

// The nonce of each sign-in, by the code Entra handed out for it.
const issuedCodes = new Map<string, string | null>();

/**
 * What Microsoft's sign-in page does once the user has signed in: returns the
 * code the browser takes back to the app. Entra ties the code to the sign-in
 * request's nonce, which comes back in the ID token.
 */
export function signInAtEntra(authorizeUrl: URL): string {
  const code = `code-${issuedCodes.size + 1}`;
  issuedCodes.set(code, authorizeUrl.searchParams.get("nonce"));
  return code;
}

// Generated on first use, so tests that never sign in skip the cost.
let signingKey: ReturnType<typeof generateKeyPair> | undefined;

async function idToken(nonce: string | null) {
  signingKey ??= generateKeyPair("RS256");
  const { privateKey } = await signingKey;
  return new SignJWT({
    ...entraFixture.claims,
    tid: tenantId,
    ver: "2.0",
    ...(nonce ? { nonce } : {}),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(testEnv.AUTH_MICROSOFT_ENTRA_ID_ID)
    .setSubject("pairwise-subject-1")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

/**
 * A successful response of Entra's v2.0 token endpoint, in the shape
 * Microsoft documents. The tokens are fakes: the app never reads inside the
 * access token, and Auth.js does not check the ID token's signature on a
 * direct TLS response.
 */
export async function entraTokenResponse({
  nonce = null,
  accessToken = "fake-access-token-1",
  refreshToken = "fake-refresh-token-1",
}: {
  nonce?: string | null;
  accessToken?: string;
  refreshToken?: string;
} = {}) {
  return {
    token_type: "Bearer",
    scope: `${testEnv.ENTRA_API_SCOPE} openid profile`,
    expires_in: 4520,
    ext_expires_in: 4520,
    access_token: accessToken,
    refresh_token: refreshToken,
    id_token: await idToken(nonce),
  };
}

// "*/greeting" matches whatever base URL and path prefix the app is
// configured with.
export const handlers = [
  http.get("*/greeting", () => HttpResponse.json(greetingFixture)),
  http.get(`${issuer}/.well-known/openid-configuration`, () =>
    HttpResponse.json(entraDiscovery),
  ),
  // The code exchange at sign-in, or a token renewal.
  http.post(entraTokenUrl, async ({ request }) => {
    const body = new URLSearchParams(await request.text());
    if (body.get("grant_type") === "refresh_token") {
      return HttpResponse.json(
        await entraTokenResponse({
          accessToken: "fake-access-token-2",
          refreshToken: "fake-refresh-token-2",
        }),
      );
    }
    const code = body.get("code") ?? "";
    if (!issuedCodes.has(code)) {
      return HttpResponse.json(
        {
          error: "invalid_grant",
          error_description: "AADSTS70000: unknown code.",
        },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      await entraTokenResponse({ nonce: issuedCodes.get(code) }),
    );
  }),
];
