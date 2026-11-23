// The spike's Worker. The first path segment chooses the database: /neon/...
// goes through HYPERDRIVE_NEON and /planetscale/... through
// HYPERDRIVE_PLANETSCALE, with the same code and versions. Under it,
// /api/auth/* is Better Auth and /wake runs `select 1`.

import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { createAuth } from "./auth.ts";
import * as schema from "./schema.ts";

type HyperdriveBinding = { connectionString: string };

type Env = {
  HYPERDRIVE_NEON: HyperdriveBinding;
  HYPERDRIVE_PLANETSCALE: HyperdriveBinding;
  RUN_TOKEN?: string;
  BETTER_AUTH_SECRET?: string;
};

const HOSTS = {
  neon: "HYPERDRIVE_NEON",
  planetscale: "HYPERDRIVE_PLANETSCALE",
} as const;

function isHost(value: string): value is keyof typeof HOSTS {
  return Object.hasOwn(HOSTS, value);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Fails closed: until the owner sets RUN_TOKEN every request gets 401, so
    // the Worker is never an open sign-up page. Don't relax this.
    if (!env.RUN_TOKEN || request.headers.get("authorization") !== `Bearer ${env.RUN_TOKEN}`) {
      return new Response("unauthorized", { status: 401 });
    }
    if (!env.BETTER_AUTH_SECRET) {
      return new Response("BETTER_AUTH_SECRET is not set", { status: 500 });
    }

    const url = new URL(request.url);
    const [, host = "", ...rest] = url.pathname.split("/");
    const tail = `/${rest.join("/")}`;
    const isAuth = tail.startsWith("/api/auth/");
    if (!isHost(host) || !(isAuth || (tail === "/wake" && request.method === "GET"))) {
      return new Response("not found", { status: 404 });
    }

    // A client per request, closed after the response is built: the runtime
    // cancels a request that waits on another request's connection.
    const client = new Client({ connectionString: env[HOSTS[host]].connectionString });
    try {
      await client.connect();
      if (!isAuth) {
        await client.query("select 1");
        return new Response(null, { status: 204 });
      }
      const auth = createAuth(drizzle(client, { schema }), {
        secret: env.BETTER_AUTH_SECRET,
        baseURL: url.origin,
        basePath: `/${host}/api/auth`,
      });
      return await auth.handler(request);
    } finally {
      await client.end();
    }
  },
};
