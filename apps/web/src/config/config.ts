// Every variable the web app reads. Code reads them through WebConfig only,
// never from the raw environment.
export type WebConfig = {
  // How the server reaches the API: a base address, and the fetch that calls
  // it when that isn't the global fetch.
  api: { baseUrl: string; fetch?: (request: Request) => Promise<Response> };
  // "blocked" asks search engines not to index any page.
  indexing: "allowed" | "blocked";
};

class ConfigError extends Error {
  override name = "ConfigError";
}

// A Service binding ignores the request's host: it hands the request to the
// bound Worker, which routes by path.
const BINDING_BASE_URL = "https://api.internal";

type Binding = { fetch: (request: Request) => Promise<Response> };

// `unknown`, not a Record: the Workers env is the interface Cloudflare.Env,
// which TypeScript won't assign to an index-signature type.
export function parseConfig(variables: unknown): WebConfig {
  const { API, API_URL, INDEXING } =
    typeof variables === "object" && variables !== null
      ? (variables as { API?: unknown; API_URL?: unknown; INDEXING?: unknown })
      : {};
  return { api: parseApi(API, API_URL), indexing: parseIndexing(INDEXING) };
}

// The API is reached either through the Service binding API (deployed) or at
// the address API_URL (local development), never both.
function parseApi(binding: unknown, apiUrl: unknown): WebConfig["api"] {
  if (binding !== undefined && apiUrl !== undefined) {
    throw new ConfigError("API and API_URL: set one, the binding or the address, not both.");
  }
  if (binding !== undefined) {
    if (!isBinding(binding)) {
      throw new ConfigError("API: must be a Service binding to the API's Worker.");
    }
    // Called on the binding, never detached (`fetch: binding.fetch`): workerd
    // rejects a binding's method called without it with "Illegal invocation".
    return { baseUrl: BINDING_BASE_URL, fetch: (request) => binding.fetch(request) };
  }
  if (typeof apiUrl !== "string" || !URL.canParse(apiUrl)) {
    throw new ConfigError(
      "API_URL: must be the API's absolute address, such as http://localhost:8787, " +
        "when there is no API binding.",
    );
  }
  const { protocol } = new URL(apiUrl);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new ConfigError("API_URL: must be an http or https address.");
  }
  return { baseUrl: apiUrl };
}

function isBinding(value: unknown): value is Binding {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function"
  );
}

function parseIndexing(value: unknown): WebConfig["indexing"] {
  if (value === "allowed" || value === "blocked") return value;
  throw new ConfigError('INDEXING: must be "allowed" or "blocked".');
}
