// Mock for "next/headers". In a test file:
//   vi.mock("next/headers", () => import("../utils/next-headers"));
// then call setRequestHeaders() and setRequestCookies() to control what the
// code under test sees, and getSetCookies() to see what it set.

interface SetCookie {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

let requestHeaders = new Headers();
let requestCookies = new Map<string, string>();
let setCookies: SetCookie[] = [];

export function setRequestHeaders(init?: HeadersInit) {
  requestHeaders = new Headers(init);
}

/** Also forgets the cookies getSetCookies() returns. */
export function setRequestCookies(cookies: Record<string, string> = {}) {
  requestCookies = new Map(Object.entries(cookies));
  setCookies = [];
}

/** The cookies the code under test set with cookies().set(), in order. */
export function getSetCookies(): readonly SetCookie[] {
  return setCookies;
}

// The request cookies appear in the Cookie header too, as in a real request.
export async function headers() {
  const all = new Headers(requestHeaders);
  if (requestCookies.size > 0) {
    all.set(
      "cookie",
      [...requestCookies].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  }
  return all;
}

export async function cookies() {
  return {
    get(name: string) {
      const value = requestCookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      setCookies.push({ name, value, options });
    },
  };
}
