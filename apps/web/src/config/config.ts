// Every variable the web app reads. Code reads them through WebConfig only,
// never from the raw environment.
export type WebConfig = {
  // The API's address, as an absolute http or https URL.
  apiUrl: string;
};

class ConfigError extends Error {
  override name = "ConfigError";
}

// `unknown`, not a Record: the Workers env is the interface Cloudflare.Env,
// which TypeScript won't assign to an index-signature type.
export function parseConfig(variables: unknown): WebConfig {
  const apiUrl =
    typeof variables === "object" && variables !== null
      ? (variables as { API_URL?: unknown }).API_URL
      : undefined;
  if (typeof apiUrl !== "string" || !URL.canParse(apiUrl)) {
    throw new ConfigError(
      "API_URL: must be the API's absolute address, such as http://localhost:8787.",
    );
  }
  const { protocol } = new URL(apiUrl);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new ConfigError("API_URL: must be an http or https address.");
  }
  return { apiUrl };
}
