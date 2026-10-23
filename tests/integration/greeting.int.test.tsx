import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGreeting, GreetingHeading } from "@/features/greeting";
import { ApiError } from "@/lib/api/errors";
import { greetingFixture } from "../mocks/handlers";
import { server } from "../mocks/server";
import { setRequestHeaders } from "../utils/next-headers";

vi.mock("next/headers", () => import("../utils/next-headers"));
vi.mock("next/server", () => import("../utils/next-server"));

// A path prefix proves the client appends /greeting to the configured base URL.
const API_BASE_URL = "http://backend.test/api";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function captureGreetingRequest() {
  const captured: { request?: Request } = {};
  server.use(
    http.get("*/greeting", ({ request }) => {
      captured.request = request;
      return HttpResponse.json(greetingFixture);
    }),
  );
  return captured;
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", API_BASE_URL);
  setRequestHeaders();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("greeting: query, API client and component together", () => {
  it("renders the greeting from the backend as the h1", async () => {
    const greeting = await getGreeting();
    render(<GreetingHeading message={greeting.message} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "hello world" }),
    ).toBeInTheDocument();
  });

  it("calls API_BASE_URL/greeting with a generated correlation id", async () => {
    const captured = captureGreetingRequest();

    await getGreeting();

    expect(captured.request?.url).toBe(`${API_BASE_URL}/greeting`);
    expect(captured.request?.headers.get("X-Correlation-Id")).toMatch(UUID);
  });

  it("forwards the incoming request's correlation id", async () => {
    setRequestHeaders({ "X-Correlation-Id": "req-7f3a" });
    const captured = captureGreetingRequest();

    await getGreeting();

    expect(captured.request?.headers.get("X-Correlation-Id")).toBe("req-7f3a");
  });

  it("rejects with ApiError on a 500 problem+json response", async () => {
    server.use(
      http.get("*/greeting", () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "Internal Server Error",
            status: 500,
          },
          {
            status: 500,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );

    const error = await getGreeting().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      title: "Internal Server Error",
    });
  });

  it("rejects with ApiError on a network error", async () => {
    server.use(http.get("*/greeting", () => HttpResponse.error()));

    const error = await getGreeting().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0 });
  });
});
