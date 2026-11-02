import { getCurrentUser } from "@/features/auth/api/queries";
import { UserMenu } from "@/features/auth/components/user-menu";

/** Reads the session, so render it inside <Suspense>. */
export async function CurrentUserMenu() {
  const user = await getCurrentUser();
  return user ? <UserMenu user={user} /> : null;
}
