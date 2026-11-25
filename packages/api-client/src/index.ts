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

// Every call is typed from the API's OpenAPI document, through the types
// generated from it: which paths a method takes, their path parameters, the
// body each route needs, and what its success answers.
type Method = "get" | "post";
type Operation<P extends keyof paths, M extends Method> = paths[P][M];

type JsonOf<R> = R extends { content: { "application/json": infer Body } } ? Body : never;

// The paths whose method M answers 200, and the JSON body of that 200.
type PathWith<M extends Method> = {
  [P in keyof paths]: paths[P] extends { [K in M]: { responses: { 200: unknown } } } ? P : never;
}[keyof paths];
type Success<P extends keyof paths, M extends Method> =
  Operation<P, M> extends { responses: { 200: infer Answer } } ? JsonOf<Answer> : never;

// The route's path parameters and JSON body, or `never` when it has none: a
// path with no parameters has `path?: never`, a route with no body
// `requestBody?: never`.
type Params<P extends keyof paths, M extends Method> =
  Operation<P, M> extends { parameters: { path: infer Values } } ? Values : never;
type Body<P extends keyof paths, M extends Method> =
  Operation<P, M> extends { requestBody: { content: { "application/json": infer Value } } }
    ? Value
    : never;

// What a call takes beside the path. `params` and `body` are required exactly
// when the route has them, and refused when it hasn't; with neither, the
// options may be left out. The brackets stop `never` from distributing.
type Options<P extends keyof paths, M extends Method> = CallOptions &
  ([Params<P, M>] extends [never] ? { params?: never } : { params: Params<P, M> }) &
  ([Body<P, M>] extends [never] ? { body?: never } : { body: Body<P, M> });
type Args<P extends keyof paths, M extends Method> = [Params<P, M>, Body<P, M>] extends [
  never,
  never,
]
  ? [options?: Options<P, M>]
  : [options: Options<P, M>];

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
  // openapi-fetch types each method per literal path; a generic path needs
  // this one widening, and Success gives the result its type back.
  type Init = {
    body?: unknown;
    headers?: Record<string, string> | undefined;
    // openapi-fetch fills the path from these and encodes each value.
    params?: { path: object };
    parseAs: "text";
  };
  const send = {
    get: client.GET,
    post: client.POST,
  } as Record<Method, (path: string, init: Init) => Promise<Answer>>;

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

  // One way to send for every method, so they take their options alike. The
  // public methods type `options` from the route; here it is only read.
  function call(method: Method, path: string, options: object = {}): Promise<unknown> {
    const { params, body, ...callOptions } = options as CallOptions & {
      params?: object;
      body?: unknown;
    };
    const init: Init = { body, headers: callOptions.headers, parseAs: "text" };
    if (params) init.params = { path: params };
    return read(send[method](path, init), callOptions);
  }

  return {
    async get<P extends PathWith<"get">>(path: P, ...[options]: Args<P, "get">) {
      return (await call("get", path, options)) as Success<P, "get">;
    },
    async post<P extends PathWith<"post">>(path: P, ...[options]: Args<P, "post">) {
      return (await call("post", path, options)) as Success<P, "post">;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
