import { connection } from "next/server";
import { signOut } from "@/lib/auth/auth";
import { LOGIN_PATH } from "@/lib/auth/paths";

// The API client sends the browser here when the backend rejects the access
// token: a Server Component cannot delete the session cookie, a route can.
export async function GET() {
  // Per request, never prerendered at build time.
  await connection();
  await signOut({ redirectTo: LOGIN_PATH });
}
