import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import type { WithDatabase } from "../database/database.ts";
import { ProblemDetails, problemResponses } from "../errors/problem-details.ts";

type WakeDeps = { withDatabase: WithDatabase };

const WakeResponse = z.object({ status: z.literal("awake") }).openapi("WakeResponse");

// The wake request: the apps send it when they open, so a database that sleeps
// when idle is awake by the time the user acts. It reads and writes no table.
const wake = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "The database answered. Never stored by a cache: a stored answer wakes nothing.",
      content: { "application/json": { schema: WakeResponse } },
    },
    503: {
      description: "The database could not be reached, or did not answer within 5 seconds.",
      content: { "application/problem+json": { schema: ProblemDetails } },
    },
    ...problemResponses,
  },
});

export function wakeRoutes({ withDatabase }: WakeDeps): OpenAPIHono {
  return new OpenAPIHono().openapi(wake, async (c) => {
    await withDatabase((db) => db.execute(sql`select 1`));
    c.header("Cache-Control", "no-store");
    return c.json({ status: "awake" as const }, 200);
  });
}
