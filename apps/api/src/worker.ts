// The Workers entry, and the only file that imports from cloudflare:*.
// createApp runs at module top level, when the Worker starts: invalid
// variables throw there, so the Worker fails to start and the error names the
// variable. Don't move it into a request handler, where the same error would
// become a 500 on every request.
// The Hyperdrive binding is read here and nowhere else, inside the function,
// so each request reads it when it opens its database client.
// The daily Cron Trigger (wrangler.jsonc) calls `scheduled`, built the same
// way and at the same time, so it runs the same checks.
import { env } from "cloudflare:workers";
import { createApp, createScheduledWork } from "./app.ts";

const database = { connectionString: () => env.HYPERDRIVE.connectionString };
const app = createApp(env, database);
const runScheduled = createScheduledWork(env, database);

export default {
  // Hono's fetch is an arrow function, so it keeps its app when taken off it.
  fetch: app.fetch,
  scheduled: () => runScheduled(),
} satisfies ExportedHandler<Env>;
