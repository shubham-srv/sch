import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth/auth";
import { LOGIN_PATH, PUBLIC_PATHS, SESSION_PATH } from "@/lib/auth/paths";
import { getServerEnv } from "@/lib/env.server";

/**
 * Runs before every page and Server Function request that `config` matches.
 * Sends signed-out users to the login page. Reading the session also renews
 * the access token shortly before it expires (src/lib/auth/tokens.ts) and
 * rewrites the session cookie. That has to happen here: Server Components
 * cannot write cookies.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // Auth.js's session route, called in process, as its own auth() does.
  const result = await handlers.GET(
    new NextRequest(new URL(SESSION_PATH, request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    }),
  );
  // Null without a session, or once renewal failed; any error fails closed.
  const session: unknown = result.ok ? await result.json() : null;
  let response: NextResponse;
  if (session) {
    // Put the rewritten cookie on the forwarded request too, so that this
    // request's render already sends a renewed access token to the backend.
    const { cookies } = new NextResponse(null, { headers: result.headers });
    for (const { name, value } of cookies.getAll()) {
      if (value) request.cookies.set(name, value);
      else request.cookies.delete(name);
    }
    response = NextResponse.next({ request: { headers: request.headers } });
  } else {
    const url = new URL(LOGIN_PATH, getServerEnv().AUTH_URL);
    if (`${pathname}${search}` !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    response = NextResponse.redirect(url);
  }
  // Auth.js's Set-Cookie headers as they are: the rewritten session cookie,
  // or its deletion when there is no valid session.
  for (const cookie of result.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js assets, files from public/, Auth.js's routes
    // (Microsoft's callback among them), and the health check, which Azure
    // calls without a session.
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|api/auth/|api/health$).*)",
  ],
};
