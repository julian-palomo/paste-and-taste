import { OpenAPIHono } from "@hono/zod-openapi";
import { parseConfig } from "./config/config.schema.ts";
import { notFound, onError } from "./errors/problem-details.ts";
import { healthRoutes } from "./health/health.routes.ts";

// The composition root: the only place that reads the raw variables or
// creates a dependency. Everything a module needs is created here and passed
// to it.
export function createApp(variables: unknown): OpenAPIHono {
  const config = parseConfig(variables);

  const app = new OpenAPIHono();
  app.route("/health", healthRoutes({ config }));

  app.notFound(notFound);
  app.onError(onError);
  return app;
}
