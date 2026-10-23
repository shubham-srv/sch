import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import {
  type ApiClient,
  CORRELATION_ID_HEADER,
  createApiClient,
} from "@/lib/api/client";
import { getServerEnv } from "@/lib/env.server";

/**
 * The backend client for the current request. Feature queries and actions
 * call this; nothing else should talk to the backend.
 */
export async function getApiClient(): Promise<ApiClient> {
  // Backend calls only ever run for a real request, never while Next.js
  // prerenders a static shell or prefetch. This also allows the random
  // correlation id below.
  await connection();
  const incoming = await headers();
  return createApiClient({
    baseUrl: getServerEnv().API_BASE_URL,
    correlationId: incoming.get(CORRELATION_ID_HEADER),
  });
}
