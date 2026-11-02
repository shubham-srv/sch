import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import {
  type ApiClient,
  CORRELATION_ID_HEADER,
  createApiClient,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/auth";
import { LOGIN_PATH, SIGN_OUT_PATH } from "@/lib/auth/paths";
import { getServerEnv } from "@/lib/env.server";

/**
 * The backend client for the current request, sending the signed-in user's
 * access token. Feature queries and actions call this; nothing else should
 * talk to the backend.
 */
export async function getApiClient(): Promise<ApiClient> {
  // Backend calls only ever run for a real request, never while Next.js
  // prerenders a static shell or prefetch. This also allows the random
  // correlation id below.
  await connection();
  const [incoming, accessToken] = await Promise.all([
    headers(),
    getAccessToken(),
  ]);
  // The proxy sends signed-out users to the login page before this runs;
  // this covers a request its matcher does not reach.
  if (!accessToken) redirect(LOGIN_PATH);

  return signOutWhenRejected(
    createApiClient({
      baseUrl: getServerEnv().API_BASE_URL,
      correlationId: incoming.get(CORRELATION_ID_HEADER),
      accessToken,
    }),
  );
}

// A 401 means the backend rejected the token, so the user is signed out. The
// sign-out route deletes the session cookie, which a Server Component cannot.
function signOutWhenRejected(client: ApiClient): ApiClient {
  const request: ApiClient["request"] = async (path, init) => {
    try {
      return await client.request(path, init);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(SIGN_OUT_PATH);
      }
      throw error;
    }
  };
  return { request, get: (path) => request(path) };
}
