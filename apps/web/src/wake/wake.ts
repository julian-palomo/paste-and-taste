import { ApiError, ApiUnreachableError, createApiClient } from "@paste-and-taste/api-client";
import type { WebConfig } from "../config/config.ts";

// Where Start serves its server functions: its default, which vite.config.ts
// keeps. A browser's later navigations call these instead of loading a page.
const SERVER_FUNCTIONS = "/_serverFn";

// A page load is what a browser sends for a page: a GET that asks for HTML.
// Not a server function, and not the favicon or anything else the browser
// fetches on its own, so a visit wakes the database once per page it loads.
function isPageLoad(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return (
    request.method === "GET" &&
    pathname !== SERVER_FUNCTIONS &&
    !pathname.startsWith(`${SERVER_FUNCTIONS}/`) &&
    (request.headers.get("Accept") ?? "").includes("text/html")
  );
}

// Sends the API's wake request, so the database is awake by the time the user
// acts. Never rejects: what fails is logged on the server and nothing else, so
// nothing reaches the page or becomes an unhandled rejection in waitUntil.
async function wake(api: WebConfig["api"], log: (line: string) => void): Promise<void> {
  const { baseUrl, fetch } = api;
  const client = createApiClient(fetch ? { baseUrl, fetch } : { baseUrl });
  try {
    await client.get("/wake");
  } catch (error) {
    if (error instanceof ApiError) log(`wake: the API answered ${error.status}`);
    else if (error instanceof ApiUnreachableError) log("wake: the API was unreachable");
    else log(`wake: ${error instanceof Error ? error.name : "failed"}`);
  }
}

type WakeOptions = {
  api: WebConfig["api"];
  // Keeps the wake running after the response has gone, as the Workers
  // runtime's waitUntil does, for up to 30 seconds.
  waitUntil: (promise: Promise<unknown>) => void;
  log?: (line: string) => void;
};

// Wraps the page handler: a page load starts the wake beside it, and the
// response never waits for the wake, whether it is slow or fails.
export function withWake(
  handle: (request: Request) => Promise<Response>,
  { api, waitUntil, log = console.error }: WakeOptions,
) {
  return (request: Request): Promise<Response> => {
    if (isPageLoad(request)) waitUntil(wake(api, log));
    return handle(request);
  };
}
