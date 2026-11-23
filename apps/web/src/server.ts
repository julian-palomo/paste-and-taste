// The Workers entry (wrangler.jsonc's main).
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  // Only the request is passed on: on Workers the second argument of fetch is
  // the env, not Start's request options.
  fetch: (request) => handler.fetch(request),
});
