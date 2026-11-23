import { createApiClient } from "@paste-and-taste/api-client";
import { createServerFn } from "@tanstack/react-start";
import { withConfig } from "../config/config.middleware.ts";
import { readHealth } from "./read-health.ts";

// A server function, so the API is called from the web app's server, on the
// first render and on later navigation alike. Never from the browser: the API
// sends no CORS headers.
export const getHealthPage = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .handler(async ({ context }) => {
    const client = createApiClient({ baseUrl: context.config.apiUrl });
    return { health: await readHealth(client), origin: context.origin };
  });
