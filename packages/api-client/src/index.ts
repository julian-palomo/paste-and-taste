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

// The paths with a POST that answers 200, the JSON body each takes, and the
// JSON body of that 200. A route with no body has `requestBody?: never`.
type PostPath = {
  [P in keyof paths]: paths[P] extends { post: { responses: { 200: unknown } } } ? P : never;
}[keyof paths];
type PostBody<P extends PostPath> = paths[P]["post"] extends {
  requestBody: { content: { "application/json": infer Body } };
}
  ? Body
  : never;
type PostResult<P extends PostPath> = paths[P]["post"]["responses"][200] extends {
  content: { "application/json": infer Body };
}
  ? Body
  : never;
// A route with a body needs it; one without takes no body, and its options
// may be left out. The brackets stop `never` from distributing.
type PostArgs<P extends PostPath> = [PostBody<P>] extends [never]
  ? [options?: CallOptions & { body?: never }]
  : [options: CallOptions & { body: PostBody<P> }];

export type CallOptions = {
  // Sent with the request as given, such as the browser's cookie,
  // cf-connecting-ip and user-agent when a server calls on its behalf.
  headers?: Record<string, string>;
  // Every Set-Cookie of the API's answer, each whole and in order, before the
  // call returns or throws. Called for any answer, an error's too; not called
  // when no answer came back. The client never reads the cookies itself.
  onSetCookie?: (cookies: string[]) => void;
};

type Answer = { data?: unknown; error?: unknown; response: Response };

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
  type Init = { body?: unknown; headers?: Record<string, string> | undefined; parseAs: "text" };
  const get = client.GET as (path: string, init: Init) => Promise<Answer>;
  const post = client.POST as (path: string, init: Init) => Promise<Answer>;

  // One reading of an answer for every method, so their errors are the same.
  // As text, so the JSON is parsed here: openapi-fetch's own parse throws a
  // bare SyntaxError on HTML and resolves an empty body as undefined. An
  // error body is read the same way whatever parseAs says.
  async function read(answer: Promise<Answer>, options: CallOptions): Promise<unknown> {
    const { data, error, response } = await answer;
    options.onSetCookie?.(response.headers.getSetCookie());
    if (!response.ok || error !== undefined) {
      throw new ApiError(response.status, toProblem(error, response.status));
    }
    if (typeof data !== "string" || data === "") {
      throw new ApiUnreachableError(`The ${response.status} response had no body.`);
    }
    try {
      return JSON.parse(data);
    } catch (cause) {
      throw new ApiUnreachableError(`The ${response.status} response was not JSON.`, { cause });
    }
  }

  return {
    async get<P extends GetPath>(path: P, options: CallOptions = {}): Promise<GetBody<P>> {
      const answer = get(path, { headers: options.headers, parseAs: "text" });
      return (await read(answer, options)) as GetBody<P>;
    },
    async post<P extends PostPath>(path: P, ...[options]: PostArgs<P>): Promise<PostResult<P>> {
      const { body, ...callOptions }: CallOptions & { body?: unknown } = options ?? {};
      const answer = post(path, { body, headers: callOptions.headers, parseAs: "text" });
      return (await read(answer, callOptions)) as PostResult<P>;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
