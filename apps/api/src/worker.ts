// The Workers entry, and the only file that imports from cloudflare:*.
// createApp runs at module top level, when the Worker starts: invalid
// variables throw there, so the Worker fails to start and the error names the
// variable. Don't move it into a request handler, where the same error would
// become a 500 on every request.
// The Hyperdrive binding is read here and nowhere else, inside the function,
// so each request reads it when it opens its database client.
import { env } from "cloudflare:workers";
import { createApp } from "./app.ts";

export default createApp(env, { connectionString: () => env.HYPERDRIVE.connectionString });
