import "server-only";
import { z } from "zod";

const ENTRA_ISSUER =
  /^https:\/\/login\.microsoftonline\.com\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/v2\.0$/i;

const serverEnvSchema = z.object({
  /** Backend API base URL. May include a path prefix, e.g. https://host/api. */
  // Not z.httpUrl(): that requires a dotted domain and rejects hosts such as
  // localhost, 127.0.0.1 and single-label container names.
  API_BASE_URL: z.url({ protocol: /^https?$/ }),
  /**
   * Public origin of this app, e.g. https://app.example.com, with no path.
   * Auth.js builds the sign-in redirect URI from it and makes cookies Secure
   * when it is https. It must match the address users open, so it is never
   * taken from request headers.
   */
  AUTH_URL: z
    .url({ protocol: /^https?$/ })
    // Auth.js would read a path as the base path of its own routes.
    .refine((url) => new URL(url).pathname === "/", "Must have no path"),
  /** Encrypts the session cookie. Changing it signs everyone out. */
  AUTH_SECRET: z.string().min(32),
  /** Application (client) id of this app's registration. */
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1),
  /** Client secret of this app's registration. */
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1),
  /**
   * https://login.microsoftonline.com/<tenant-id>/v2.0. A tenant id rather
   * than "common" or "organizations" keeps sign-in to this one organization.
   */
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z
    .string()
    .regex(
      ENTRA_ISSUER,
      "Must be https://login.microsoftonline.com/<tenant-id>/v2.0",
    ),
  /** Backend API scope requested at sign-in, e.g. api://<backend-id>/access_scan. */
  ENTRA_API_SCOPE: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Runtime server config, validated on first call rather than at import:
 * `next build` runs without runtime variables, so import-time validation
 * would break the build.
 */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid server environment variables:\n${z.prettifyError(result.error)}`,
      );
    }
    cached = result.data;
  }
  return cached;
}
