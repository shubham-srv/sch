/** RFC 9457 problem details, as returned by ASP.NET Core. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

interface ApiErrorInit {
  status: number;
  title: string;
  detail?: string;
  type?: string;
  problem?: ProblemDetails;
  cause?: unknown;
}

/** Any failed backend call: an HTTP error status or no response at all. */
export class ApiError extends Error {
  override readonly name = "ApiError";
  /** HTTP status, or 0 when no response was received (network failure). */
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly type?: string;
  /** The parsed problem details body, when the backend sent one. */
  readonly problem?: ProblemDetails;

  constructor({ status, title, detail, type, problem, cause }: ApiErrorInit) {
    super(detail ? `${title}: ${detail}` : title, { cause });
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.problem = problem;
  }
}

export function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== "object" || body === null) return false;
  const { title, status, type } = body as Record<string, unknown>;
  return (
    typeof title === "string" ||
    typeof status === "number" ||
    typeof type === "string"
  );
}

/** An HTTP error response, with or without a ProblemDetails body. */
export function apiErrorFromResponse(
  response: Response,
  body: unknown,
): ApiError {
  const fallbackTitle = response.statusText || `HTTP ${response.status}`;
  if (isProblemDetails(body)) {
    return new ApiError({
      status: response.status,
      title: body.title ?? fallbackTitle,
      detail: body.detail,
      type: body.type,
      problem: body,
    });
  }
  return new ApiError({ status: response.status, title: fallbackTitle });
}

/** A request that never produced a usable response (network failure). */
export function apiErrorFromRequestFailure(cause: unknown): ApiError {
  return new ApiError({
    status: 0,
    title: "Request failed",
    detail: cause instanceof Error ? cause.message : undefined,
    cause,
  });
}
