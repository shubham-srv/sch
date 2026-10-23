import "server-only";
import createClient, { type Client, type Middleware } from "openapi-fetch";
import type { paths } from "@/lib/api/generated/schema";

export const CORRELATION_ID_HEADER = "X-Correlation-Id";

// Incoming ids are forwarded only if they look like an id, so a caller cannot
// push arbitrary text into backend logs.
const CORRELATION_ID_PATTERN = /^[\w.:-]{1,128}$/;

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Correlation id from the incoming request; a new one is generated if absent or invalid. */
  correlationId?: string | null;
}

export function createApiClient({
  baseUrl,
  correlationId,
}: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl });
  client.use(
    correlationIdMiddleware(
      correlationId && CORRELATION_ID_PATTERN.test(correlationId)
        ? correlationId
        : crypto.randomUUID(),
    ),
  );
  return client;
}

function correlationIdMiddleware(correlationId: string): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set(CORRELATION_ID_HEADER, correlationId);
      return request;
    },
  };
}
