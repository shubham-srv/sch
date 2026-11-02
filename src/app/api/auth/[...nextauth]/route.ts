import { handlers } from "@/lib/auth/auth";

// Auth.js's routes, including Microsoft's callback,
// /api/auth/callback/microsoft-entra-id.
export const { GET, POST } = handlers;
