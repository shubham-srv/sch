import { describe, expect, it } from "vitest";
import {
  ApiError,
  apiErrorFromRequestFailure,
  apiErrorFromResponse,
} from "./errors";

describe("apiErrorFromResponse", () => {
  it("turns a ProblemDetails body into an ApiError", () => {
    const problem = {
      type: "https://example.com/problems/not-found",
      title: "Resource not found",
      status: 404,
      detail: "No item exists with id 42.",
    };

    const error = apiErrorFromResponse(
      new Response(null, { status: 404 }),
      problem,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      title: "Resource not found",
      detail: "No item exists with id 42.",
      type: problem.type,
      problem,
    });
  });

  it("turns a bare HTTP status into an ApiError", () => {
    const error = apiErrorFromResponse(
      new Response(null, { status: 503, statusText: "Service Unavailable" }),
      undefined,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, title: "Service Unavailable" });
  });

  it("uses the status code as the title when there is no status text", () => {
    const error = apiErrorFromResponse(
      new Response(null, { status: 502 }),
      "<html>Bad Gateway</html>",
    );

    expect(error).toMatchObject({ status: 502, title: "HTTP 502" });
  });
});

describe("apiErrorFromRequestFailure", () => {
  it("turns a network failure into an ApiError", () => {
    const cause = new TypeError("fetch failed");

    const error = apiErrorFromRequestFailure(cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0,
      title: "Request failed",
      detail: "fetch failed",
      cause,
    });
  });
});
