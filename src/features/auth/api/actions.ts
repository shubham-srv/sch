"use server";

import { signIn, signOut } from "@/lib/auth/auth";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { safeNextPath } from "@/lib/auth/safe-redirect";

/** Leaves for Microsoft's sign-in page, then returns to the form's `next`. */
export async function signInWithMicrosoft(formData: FormData): Promise<void> {
  await signIn("microsoft-entra-id", {
    redirectTo: safeNextPath(formData.get("next")),
  });
}

/** Ends the session in this app, not at Microsoft. */
export async function signOutOfApp(): Promise<void> {
  await signOut({ redirectTo: LOGIN_PATH });
}
