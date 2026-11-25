import type { WebConfig } from "./config/config.ts";

// With indexing blocked, every response from the Worker carries
// X-Robots-Tag: noindex, which search engines read as the robots meta tag.
// Static assets are served before the Worker runs and don't get it; pages
// always come from the Worker.
export function applyIndexing(response: Response, indexing: WebConfig["indexing"]): Response {
  if (indexing === "allowed") return response;
  // A copy: a fetched response's headers can be immutable.
  const blocked = new Response(response.body, response);
  blocked.headers.set("X-Robots-Tag", "noindex");
  return blocked;
}
