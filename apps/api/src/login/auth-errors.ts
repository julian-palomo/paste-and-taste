import { APIError } from "better-auth/api";
import type { AppError } from "../errors/app-error.ts";

// Better Auth throws its own APIError, which onError would answer as a 500.
// This turns the codes a route expects into the app's errors; anything else
// is rethrown as it is, and reaches onError as a 500, logged.
export function toAppError(error: unknown, expected: Record<string, () => AppError>): unknown {
  if (error instanceof APIError) {
    const code = (error.body as { code?: unknown } | undefined)?.code;
    const make = typeof code === "string" ? expected[code] : undefined;
    if (make) return make();
  }
  return error;
}
