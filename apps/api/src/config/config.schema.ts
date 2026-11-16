import { z } from "zod";

// Every variable the API reads, each with its description. Code reads them
// through AppConfig only, never from the raw environment.
const configSchema = z.object({
  APP_ENV: z
    .enum(["development", "preview", "production"])
    .describe("Where this API runs: development (local), preview or production."),
});

export type AppConfig = z.infer<typeof configSchema>;

class ConfigError extends Error {
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
