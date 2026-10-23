import { describe, expect, it } from "vitest";
import { ApiError, unwrap } from "./errors";

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("Expected the promise to reject");
    },
    (error: unknown) => error,
  );
}

describe("unwrap", () => {
  it("returns the data of a successful response", async () => {
    const response = new Response(null, { status: 200 });
    await expect(
      unwrap(Promise.resolve({ data: { message: "hi" }, response })),
    ).resolves.toEqual({ message: "hi" });
  });

  it("turns a ProblemDetails body into an ApiError", async () => {
    const problem = {
      type: "https://example.com/problems/not-found",
      title: "Greeting not found",
      status: 404,
      detail: "There is no greeting today.",
    };
    const response = new Response(null, { status: 404 });

    const error = await rejectionOf(
      unwrap(Promise.resolve({ error: problem, response })),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      title: "Greeting not found",
      detail: "There is no greeting today.",
      type: problem.type,
      problem,
    });
  });

  it("turns a bare HTTP status into an ApiError", async () => {
    const response = new Response(null, {
      status: 503,
      statusText: "Service Unavailable",
    });

    const error = await rejectionOf(
      unwrap(Promise.resolve({ error: "", response })),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, title: "Service Unavailable" });
  });

  it("uses the status code as the title when there is no status text", async () => {
    const response = new Response(null, { status: 502 });

    const error = await rejectionOf(
      unwrap(Promise.resolve({ error: undefined, response })),
    );

    expect(error).toMatchObject({ status: 502, title: "HTTP 502" });
  });

  it("turns a network failure into an ApiError", async () => {
    const cause = new TypeError("fetch failed");

    const error = await rejectionOf(unwrap(Promise.reject(cause)));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0,
      title: "Request failed",
      detail: "fetch failed",
      cause,
    });
  });
});
