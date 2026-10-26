import "server-only";
import {
  apiErrorFromRequestFailure,
  apiErrorFromResponse,
} from "@/lib/api/errors";

export const CORRELATION_ID_HEADER = "X-Correlation-Id";

// Incoming ids are forwarded only if they look like an id, so a caller cannot
// push arbitrary text into backend logs.
const CORRELATION_ID_PATTERN = /^[\w.:-]{1,128}$/;

export interface ApiClient {
  /**
   * Sends a request to `path` (relative to the base URL) and resolves to the
   * parsed JSON body, or `undefined` for an empty body. The body is `unknown`
   * until a feature mapper validates it. Rejects with ApiError on an HTTP
   * error status or when no response arrives.
   */
  request(path: string, init?: RequestInit): Promise<unknown>;
  get(path: string): Promise<unknown>;
}

export interface ApiClientOptions {
  /** May include a path prefix, e.g. https://host/api. */
  baseUrl: string;
  /** Correlation id from the incoming request; a new one is generated if absent or invalid. */
  correlationId?: string | null;
  /** For tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export function createApiClient({
  baseUrl,
  correlationId,
  fetch: fetchImpl = fetch,
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");
  const id =
    correlationId && CORRELATION_ID_PATTERN.test(correlationId)
      ? correlationId
      : crypto.randomUUID();

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set(CORRELATION_ID_HEADER, id);
    headers.set("Accept", "application/json");

    let response: Response;
    let body: unknown;
    try {
      response = await fetchImpl(`${root}${path}`, { ...init, headers });
      body = parseBody(await response.text());
    } catch (cause) {
      throw apiErrorFromRequestFailure(cause);
    }

    if (!response.ok) throw apiErrorFromResponse(response, body);
    return body;
  }

  return {
    request,
    get: (path) => request(path),
  };
}

// JSON when possible; plain text otherwise, so an HTML error page from a
// proxy still reaches the error handling instead of throwing here.
function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
