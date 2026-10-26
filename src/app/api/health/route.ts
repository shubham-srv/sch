import { connection } from "next/server";

/** Liveness probe for Azure App Service. Must never call the backend. */
export async function GET() {
  // Answer at request time, so a healthy response means the server is up,
  // not that a build-time copy was cached.
  await connection();
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
