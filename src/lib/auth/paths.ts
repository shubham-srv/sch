// Routes of the sign-in flow.

export const LOGIN_PATH = "/login";
/** GET: signs the user out after the backend rejects their access token. */
export const SIGN_OUT_PATH = "/auth/signout";

/** Pages and routes the proxy lets through without a session. */
export const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH, SIGN_OUT_PATH];

/** Auth.js's session route. Its routes are under /api/auth, its default. */
export const SESSION_PATH = "/api/auth/session";
