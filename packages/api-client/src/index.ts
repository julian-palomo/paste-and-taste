import createClient from "openapi-fetch";
import type { components, paths } from "./schema.d.ts";

export type ProblemDetails = components["schemas"]["ProblemDetails"];

// The API answered with an error: one place to read what went wrong. `status`
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

// No usable answer came back: `fetch` rejected, or a 200's body is empty or
// isn't JSON (a captive portal, a wrong address). `cause` is the platform's
// error when there is one.
export class ApiUnreachableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiUnreachableError";
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
  const client = createClient<paths>({
    baseUrl,
    fetch: async (request) => {
      try {
        // The global is read on each call, so a fetch replaced later is used.
        return await (fetch ?? globalThis.fetch)(request);
      } catch (cause) {
        throw new ApiUnreachableError("The API could not be reached.", { cause });
      }
    },
  });
  // openapi-fetch types GET per literal path; a generic path needs this one
  // widening, and GetBody gives the result its type back.
  const get = client.GET as (
    path: string,
    init: { parseAs: "text" },
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;

  return {
    async get<P extends GetPath>(path: P): Promise<GetBody<P>> {
      // As text, so the JSON is parsed here: openapi-fetch's own parse throws
      // a bare SyntaxError on HTML and resolves an empty body as undefined.
      // An error body is read the same way whatever parseAs says.
      const { data, error, response } = await get(path, { parseAs: "text" });
      if (!response.ok || error !== undefined) {
        throw new ApiError(response.status, toProblem(error, response.status));
      }
      if (typeof data !== "string" || data === "") {
        throw new ApiUnreachableError(`The ${response.status} response had no body.`);
      }
      try {
        return JSON.parse(data) as GetBody<P>;
      } catch (cause) {
        throw new ApiUnreachableError(`The ${response.status} response was not JSON.`, { cause });
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
