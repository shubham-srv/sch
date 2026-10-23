import "server-only";
import { toGreeting } from "@/features/greeting/api/mappers";
import type { Greeting } from "@/features/greeting/types";
import { unwrap } from "@/lib/api/errors";
import { getApiClient } from "@/lib/api/server";

/** GET /greeting. Throws ApiError when the backend call fails. */
export async function getGreeting(): Promise<Greeting> {
  const client = await getApiClient();
  return toGreeting(await unwrap(client.GET("/greeting")));
}
