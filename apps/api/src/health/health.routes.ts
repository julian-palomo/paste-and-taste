import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppConfig, AppEnvironment } from "../config/config.schema.ts";
import { problemResponses } from "../errors/problem-details.ts";

type HealthDeps = { config: AppConfig };

const HealthResponse = z
  .object({ status: z.literal("ok"), environment: AppEnvironment })
  .openapi("HealthResponse");

// Checks nothing else yet: each dependency adds its own check when it arrives.
const health = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "The API is up.",
      content: { "application/json": { schema: HealthResponse } },
    },
    ...problemResponses,
  },
});

export function healthRoutes({ config }: HealthDeps): OpenAPIHono {
  return new OpenAPIHono().openapi(health, (c) =>
    c.json({ status: "ok" as const, environment: config.APP_ENV }, 200),
  );
}
