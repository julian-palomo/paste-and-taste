import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "./app-error.ts";
import { loggableError } from "./loggable-error.ts";

// The one place an error becomes a response: Problem Details, RFC 9457.
// createApp installs these on the root app; a module never sets its own
// onError or notFound, since Hono calls notFound only on the root app.

// Every error body, as the document describes it and clients read it.
export const ProblemDetails = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
  })
  .openapi("ProblemDetails");

type Problem = z.infer<typeof ProblemDetails>;

// The `default` response every route declares beside its success responses.
export const problemResponses = {
  default: {
    description: "An error, as Problem Details (RFC 9457).",
    content: { "application/problem+json": { schema: ProblemDetails } },
  },
};

// The 4xx and 5xx reason phrases of RFC 9110, section 15, plus 429 from
// RFC 6585. Kept here, not taken from node:http, so the module that turns
// every error into a response depends on no Node API.
const REASON_PHRASES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  421: "Misdirected Request",
  422: "Unprocessable Content",
  426: "Upgrade Required",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
};

export function notFound(c: Context): Response {
  return problemResponse(c, {
    type: "about:blank",
    title: title(404),
    status: 404,
    detail: `No route for ${c.req.method} ${c.req.path}.`,
  });
}

export function onError(error: Error, c: Context): Response {
  if (error instanceof AppError) {
    const { type, title, status, message } = error;
    return problemResponse(c, { type, title, status, detail: message });
  }

  // Hono's own errors. Its message is an empty string unless one was given,
  // and `detail` must be a string a client can show.
  if (error instanceof HTTPException) {
    const { status, message } = error;
    return problemResponse(c, {
      type: "about:blank",
      title: title(status),
      status,
      detail: message || title(status),
    });
  }

  // Unexpected: its message and stack go to the log only. Never put them in
  // the body, they can name hosts, queries or values. From the request, the
  // log takes only the method and the path: never a header, a cookie or the
  // query string.
  console.error(`${c.req.method} ${c.req.path} failed: ${loggableError(error)}`);
  return problemResponse(c, {
    type: "about:blank",
    title: title(500),
    status: 500,
    detail: "The server could not complete the request.",
  });
}

function title(status: number): string {
  return REASON_PHRASES[status] ?? "Error";
}

// Built through the context, never as a bare Response: headers a middleware
// already set, such as a renewed session's Set-Cookie, must go out with the
// error too. A bare Response would drop them.
function problemResponse(c: Context, problem: Problem): Response {
  return c.body(JSON.stringify(problem), problem.status as ContentfulStatusCode, {
    "Content-Type": "application/problem+json",
  });
}
