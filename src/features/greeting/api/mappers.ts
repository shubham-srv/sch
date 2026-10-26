import { z } from "zod";
import type { Greeting } from "@/features/greeting/types";

// What GET /greeting returns. This schema is the frontend's copy of the
// backend contract (there is no OpenAPI): keep it in step with the backend.
// TODO(owner): confirm the response shape with the backend owner.
const greetingDtoSchema = z.object({
  message: z.string(),
});

/** The single place to adapt if the backend's greeting shape changes. */
export function toGreeting(dto: unknown): Greeting {
  const result = greetingDtoSchema.safeParse(dto);
  if (!result.success) {
    throw new Error(
      `Unexpected greeting response from the backend:\n${z.prettifyError(result.error)}`,
    );
  }
  return { message: result.data.message };
}
