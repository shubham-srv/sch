import "@testing-library/jest-dom/vitest";
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest globals are off, so RTL cannot register its own afterEach cleanup.
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/server";

// Any request without a matching handler fails the test, so tests never reach
// a real network. (MSW 3 renamed onUnhandledRequest to onUnhandledFrame.)
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
