// The scratch Worker: measures one route for one post from Cloudflare's
// network, with the same route code the script runs locally. It holds no
// sample: the script sends one post per request, and the answer is a
// Measurement, which holds no text from the post.

import { parsePostLink } from "./links.ts";
import { measureRoute } from "./routes/index.ts";
import { ROUTES, type RouteName } from "./types.ts";

type Env = { RUN_TOKEN?: string };

function isRoute(value: unknown): value is RouteName {
  return ROUTES.some((route) => route === value);
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Fails closed: until the owner sets RUN_TOKEN every request gets 401, so
    // the Worker is never an open relay to Instagram. Don't relax this.
    if (!env.RUN_TOKEN || request.headers.get("authorization") !== `Bearer ${env.RUN_TOKEN}`) {
      return new Response("unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/measure") {
      return new Response("not found", { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("the body must be JSON", { status: 400 });
    }
    const route = field(body, "route");
    const url = field(body, "url");
    const link = typeof url === "string" ? parsePostLink(url) : null;
    if (!isRoute(route) || !link) {
      return new Response("expected { route, url } with a known route and a post link", {
        status: 400,
      });
    }
    return Response.json(await measureRoute(route, link));
  },
};
