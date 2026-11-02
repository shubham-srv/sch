import "server-only";
import type { CurrentUser } from "@/features/auth/types";
import { auth } from "@/lib/auth/auth";

/**
 * The signed-in user, or null without a session.
 *
 * TODO(backend): placeholder until the backend's current-user endpoint
 * exists. Until then it returns the name and email from the sign-in token.
 * When the endpoint is ready, call it through getApiClient(), validate the
 * response in api/mappers.ts, and add tests.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = (await auth())?.user;
  if (!user?.name || !user.email) return null;
  return { name: user.name, email: user.email };
}
