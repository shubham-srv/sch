// Mock for "next/navigation". In a test file:
//   vi.mock("next/navigation", () => import("../utils/next-navigation"));
// redirect() throws to stop rendering; this one throws a RedirectError that
// carries the URL.

export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}

export function redirect(url: string): never {
  throw new RedirectError(url);
}
