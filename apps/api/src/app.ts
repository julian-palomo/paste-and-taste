import { Hono } from "hono";
import { parseConfig } from "./config/config.schema";
import { notFound, onError } from "./errors/problem-details";
import { healthRoutes } from "./health/health.routes";

// The composition root: the only place that reads the raw variables or
// creates a dependency. Everything a module needs is created here and passed
// to it.
export function createApp(variables: unknown): Hono {
  const config = parseConfig(variables);

  const app = new Hono();
  app.route("/health", healthRoutes({ config }));

  app.notFound(notFound);
  app.onError(onError);
  return app;
}
