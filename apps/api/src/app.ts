import { OpenAPIHono } from "@hono/zod-openapi";
import { parseConfig } from "./config/config.schema.ts";
import { type DatabaseSource, type WithDatabase, withDatabase } from "./database/database.ts";
import { notFound, onError } from "./errors/problem-details.ts";
import { healthRoutes } from "./health/health.routes.ts";
import { wakeRoutes } from "./wake/wake.routes.ts";

// The only path other workspaces import (package.json, "./app"), so what
// they need to call createApp is exported from here.
export { type DatabaseSource, noDatabase } from "./database/database.ts";

// The composition root: the only place that reads the raw variables or
// creates a dependency. Everything a module needs is created here and passed
// to it. The database is required: an application built without one is a
// mistake typecheck should catch, so callers that never use it pass
// noDatabase.
export function createApp(variables: unknown, database: DatabaseSource): OpenAPIHono {
  const config = parseConfig(variables);
  const withThisDatabase: WithDatabase = (work) => withDatabase(database, work);

  const app = new OpenAPIHono();
  app.route("/health", healthRoutes({ config }));
  app.route("/wake", wakeRoutes({ withDatabase: withThisDatabase }));

  app.notFound(notFound);
  app.onError(onError);
  return app;
}
