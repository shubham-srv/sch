// Mock for "next/headers". In a test file:
//   vi.mock("next/headers", () => import("../utils/next-headers"));
// then call setRequestHeaders() to control what the code under test sees.

let requestHeaders = new Headers();

export function setRequestHeaders(init?: HeadersInit) {
  requestHeaders = new Headers(init);
}

export async function headers() {
  return requestHeaders;
}
