// Mock for "next/server". In a test file:
//   vi.mock("next/server", () => import("../utils/next-server"));
// connection() needs a Next.js request scope, which tests do not have.

export async function connection() {}
