import { http, HttpResponse } from "msw";

// The fake backend for Vitest (through MSW's setupServer). Defaults are the
// happy path; a test puts the UI into another state (error, empty, slow) by
// overriding a handler with server.use(...). E2E tests use a real backend.

export const greetingFixture = { message: "hello world" };

// "*/greeting" matches whatever base URL and path prefix the app is
// configured with.
export const handlers = [
  http.get("*/greeting", () => HttpResponse.json(greetingFixture)),
];
