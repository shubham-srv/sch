import { http, HttpResponse } from "msw";

// The single fake backend. Vitest uses these handlers through MSW's
// setupServer, and the E2E mock API (e2e/mock-api/server.ts) serves the same
// ones over HTTP.

export const greetingFixture = { message: "hello world" };

// "*/greeting" matches whatever base URL and path prefix the app is
// configured with.
export const handlers = [
  http.get("*/greeting", () => HttpResponse.json(greetingFixture)),
];
