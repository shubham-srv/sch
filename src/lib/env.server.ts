import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  /** Backend API base URL. May include a path prefix, e.g. https://host/api. */
  // Not z.httpUrl(): that requires a dotted domain and rejects hosts such as
  // localhost, 127.0.0.1 and single-label container names.
  API_BASE_URL: z.url({ protocol: /^https?$/ }),
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
