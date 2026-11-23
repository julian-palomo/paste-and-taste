// The Workers entry (wrangler.jsonc's main), and the only file that imports
// from cloudflare:*. parseConfig runs at module top level, when the Worker
// starts: an invalid API_URL throws there, so the Worker fails to start and
// the error names the variable. Don't move it into fetch, where the same
// error would become a broken page on every request.

import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { parseConfig, type WebConfig } from "./config/config.ts";

const config = parseConfig(env);

// The context every request carries into Start's middleware, server functions
// and server routes. `withConfig` hands it on to a server function.
declare module "@tanstack/react-router" {
  interface Register {
    server: { requestContext: { config: WebConfig } };
  }
}

export default createServerEntry({
  // Only the request is passed on: on Workers the second argument of fetch is
  // the env, not Start's request options.
  fetch: (request) => handler.fetch(request, { context: { config } }),
});
