// Checks a running API from outside: /health and one unknown route must answer
// as specified. scripts/smoke.ts runs this file with Node directly, which
// strips the types: keep it free of relative imports and of TypeScript-only
// syntax such as enums.

type Fetch = (url: string) => Promise<Response>;

const UNKNOWN_ROUTE = "/smoke-check/no-such-route";
const ENVIRONMENTS = ["development", "preview", "production"];

// Returns what is wrong, one line per route; an empty list means both passed.
export async function checkApi(baseUrl: string, fetchFn: Fetch): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const failures: string[] = [];

  const health = await fetchFn(`${base}/health`);
  const healthBody = await readBody(health);
  if (health.status !== 200 || !isHealthy(healthBody)) {
    failures.push(
      `/health answered ${health.status} ${JSON.stringify(healthBody)}; ` +
        `expected 200 {"status":"ok","environment":"<APP_ENV>"}`,
    );
  }

  const unknown = await fetchFn(`${base}${UNKNOWN_ROUTE}`);
  const contentType = unknown.headers.get("content-type") ?? "";
  const unknownBody = await readBody(unknown);
  if (
    unknown.status !== 404 ||
    !contentType.startsWith("application/problem+json") ||
    !isProblem(unknownBody, 404)
  ) {
    failures.push(
      `unknown route ${UNKNOWN_ROUTE} answered ${unknown.status} ${contentType} ` +
        `${JSON.stringify(unknownBody)}; expected 404 application/problem+json ` +
        "with type, title, status and detail",
    );
  }

  return failures;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isHealthy(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const { status, environment } = body as Record<string, unknown>;
  return (
    status === "ok" &&
    typeof environment === "string" &&
    ENVIRONMENTS.includes(environment) &&
    Object.keys(body).length === 2
  );
}

function isProblem(body: unknown, status: number): boolean {
  if (typeof body !== "object" || body === null) return false;
  const problem = body as Record<string, unknown>;
  return (
    typeof problem.type === "string" &&
    typeof problem.title === "string" &&
    problem.status === status &&
    typeof problem.detail === "string"
  );
}
