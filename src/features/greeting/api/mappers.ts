import { z } from "zod";
import type { Greeting } from "@/features/greeting/types";
import type { components } from "@/lib/api/generated/schema";

type GreetingDto = components["schemas"]["Greeting"];

// Checked at runtime: the deployed backend can drift from the committed
// contract. `satisfies` keeps this schema in step with the generated type.
const greetingDtoSchema = z.object({
  message: z.string(),
}) satisfies z.ZodType<GreetingDto>;

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
