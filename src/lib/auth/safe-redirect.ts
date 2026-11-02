const BASE = "http://localhost";

/**
 * Returns `value` when it is a path on this site, otherwise "/". Used for the
 * `next` parameter, so a crafted sign-in link cannot send the user to another
 * site after signing in (an open redirect).
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return "/";
  // Browsers treat a backslash like a slash ("/\host" is "//host") and drop
  // control characters ("/\t/host" becomes "//host"), so both are refused.
  if (!value.startsWith("/") || /[\\\p{Cc}]/u.test(value)) return "/";
  // "//host" is a path to the parser above but another origin to a browser.
  const url = new URL(value, BASE);
  if (url.origin !== BASE) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
