// Server environment for tests that use the real config. In a test file:
//   beforeEach(() => stubServerEnv());
//   afterEach(() => vi.unstubAllEnvs());

import { vi } from "vitest";

export const testEnv = {
  // A path prefix proves the client appends request paths to the base URL.
  API_BASE_URL: "http://backend.test/api",
  AUTH_URL: "http://localhost:3000",
  AUTH_SECRET: "test-auth-secret-of-at-least-32-characters",
  AUTH_MICROSOFT_ENTRA_ID_ID: "22222222-2222-2222-2222-222222222222",
  AUTH_MICROSOFT_ENTRA_ID_SECRET: "test-client-secret",
  AUTH_MICROSOFT_ENTRA_ID_ISSUER:
    "https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0",
  ENTRA_API_SCOPE: "api://33333333-3333-3333-3333-333333333333/access_scan",
};

export function stubServerEnv() {
  for (const [name, value] of Object.entries(testEnv)) {
    vi.stubEnv(name, value);
  }
}
