import { z } from "zod";

// Where the API runs. The health response reports it with this same schema.
export const AppEnvironment = z.enum(["development", "preview", "production"]);

// Every variable the API reads, each with its description. Code reads them
// through AppConfig only, never from the raw environment.
const configSchema = z.object({
  APP_ENV: AppEnvironment.describe(
    "Where this API runs: development (local), preview or production.",
  ),
  // Optional: only the login uses it, and a login route without it answers
  // 503 naming it, so a caller that never signs in doesn't need one.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .optional()
    .describe("Better Auth's secret, at least 32 characters. Never committed."),
  PASSKEY_RP_ID: z
    .string()
    .optional()
    .describe("The site a passkey belongs to: localhost in development, the app's domain later."),
  RESEND_API_KEY: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Resend's key for sending the sign-in code by email. Without it, development prints the code.",
    ),
  PASSKEY_ORIGIN: z
    .url()
    .optional()
    .describe("The address of the page the browser runs the passkey ceremony on."),
  // Optional so a missing value fails closed: the app treats it as "invited".
  SIGN_UP: z
    .enum(["invited", "open"])
    .optional()
    .describe(
      'Who may get a sign-in code: "invited" (an invited address or an account) or "open" (anyone).',
    ),
});

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

// `unknown`, not a Record: the Workers env is the interface Cloudflare.Env,
// which TypeScript won't assign to an index-signature type.
export function parseConfig(source: unknown): AppConfig {
  const result = configSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join(".");
    const description = configSchema.shape[key as keyof AppConfig]?.description;
    return `${key}: ${issue.message}${description ? ` (${description})` : ""}`;
  });
  throw new ConfigError(`Invalid configuration. ${problems.join("; ")}`);
}
