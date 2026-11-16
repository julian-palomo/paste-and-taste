import createClient from "openapi-fetch";
import type { components, paths } from "./schema.d.ts";

export type ProblemDetails = components["schemas"]["ProblemDetails"];

// Every failed call throws this: one place to read what went wrong. `status`
// is the response's; `problem` is its body when that is Problem Details.
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(`${status} ${problem.title}: ${problem.detail}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

// Never trust an error body's shape: whatever sits in front of the API (a
// gateway, a proxy) can answer with HTML or plain text.
function toProblem(body: unknown, status: number): ProblemDetails {
  if (isProblemDetails(body)) return body;
  return {
    type: "about:blank",
    title: `HTTP ${status}`,
    status,
    detail: "The response was not Problem Details.",
  };
}

function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== "object" || body === null) return false;
  const { type, title, status, detail } = body as Record<string, unknown>;
  return (
    typeof type === "string" &&
    typeof title === "string" &&
    typeof status === "number" &&
    typeof detail === "string"
  );
}

// The paths with a GET that answers 200, and the JSON body of that 200, read
// from the types generated from the API's OpenAPI document.
type GetPath = {
  [P in keyof paths]: paths[P] extends { get: { responses: { 200: unknown } } } ? P : never;
}[keyof paths];
type GetBody<P extends GetPath> = paths[P]["get"]["responses"][200] extends {
  content: { "application/json": infer Body };
}
  ? Body
  : never;

type ApiClientOptions = {
  baseUrl: string;
  // Defaults to the global fetch. Tests pass the application's own.
  fetch?: (request: Request) => Promise<Response>;
};

export function createApiClient({ baseUrl, fetch }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl, ...(fetch ? { fetch } : {}) });
  // openapi-fetch types GET per literal path; a generic path needs this one
  // widening, and GetBody gives the result its type back.
  const get = client.GET as (
    path: string,
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;

  return {
    async get<P extends GetPath>(path: P): Promise<GetBody<P>> {
      const { data, error, response } = await get(path);
      if (!response.ok || error !== undefined) {
        throw new ApiError(response.status, toProblem(error, response.status));
      }
      return data as GetBody<P>;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
