import { OpenAPIHono } from "@hono/zod-openapi";
import { type AppConfig, parseConfig } from "./config/config.schema.ts";
import { type DatabaseSource, type WithDatabase, withDatabase } from "./database/database.ts";
import { loggableError } from "./errors/loggable-error.ts";
import { notFound, onError } from "./errors/problem-details.ts";
import { healthRoutes } from "./health/health.routes.ts";
import { type CodeSender, chooseCodeSender } from "./login/code-sender.ts";
import { deleteExpiredLoginRows } from "./login/expired-rows.repository.ts";
import { loginRoutes } from "./login/login.routes.ts";
import { createRequestLimiter, LIMITS } from "./login/request-limiter.ts";
import { createSessionReader } from "./login/session-reader.ts";
import { createWithAuth } from "./login/with-auth.ts";
import { createPostgresRecipesRepository } from "./recipes/postgres-recipes.repository.ts";
import { recipesRoutes } from "./recipes/recipes.routes.ts";
import { createRecipesService } from "./recipes/recipes.service.ts";
import { wakeRoutes } from "./wake/wake.routes.ts";

// The only path other workspaces import (package.json, "./app"), so what
// they need to call createApp is exported from here.
export { type DatabaseSource, noDatabase } from "./database/database.ts";

// What a caller may choose instead of the default. Tests pass a sender that
// keeps the codes, and a daily ceiling on codes of their own; everywhere else
// the default applies.
type AppOptions = { codeSender?: CodeSender; codesPerDay?: number };

// The composition root, with createScheduledWork below for the cron: the
// only places that read the raw variables or create a dependency. Everything a module needs is created here and passed
// to it. The database is required: an application built without one is a
// mistake typecheck should catch, so callers that never use it pass
// noDatabase.
export function createApp(
  variables: unknown,
  database: DatabaseSource,
  options: AppOptions = {},
): OpenAPIHono {
  const config = parseConfig(variables);
  const withThisDatabase: WithDatabase = (work) => withDatabase(database, work);

  const app = new OpenAPIHono();
  app.route("/health", healthRoutes({ config }));
  app.route("/wake", wakeRoutes({ withDatabase: withThisDatabase }));
  // In preview and production /login/* and /recipes/* are the usual 404.
  if (loginIsMounted(config)) {
    const withAuth = createWithAuth({
      withDatabase: withThisDatabase,
      settings: {
        secret: config.BETTER_AUTH_SECRET,
        passkeyRpId: config.PASSKEY_RP_ID,
        passkeyOrigin: config.PASSKEY_ORIGIN,
      },
    });
    app.route(
      "/login",
      loginRoutes({
        withAuth,
        requestLimiter: createRequestLimiter(),
        codeSender: options.codeSender ?? chooseCodeSender(config),
        // A missing value fails closed.
        signUp: config.SIGN_UP ?? "invited",
        codesPerDay: { ...LIMITS.codesPerDay, max: options.codesPerDay ?? LIMITS.codesPerDay.max },
      }),
    );
    // A user's recipes need a session, so they run where the login does.
    app.route(
      "/recipes",
      recipesRoutes({
        service: createRecipesService(createPostgresRecipesRepository(withThisDatabase)),
        currentUser: createSessionReader(withAuth),
      }),
    );
  }

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

// Login runs only in development until the issue that deploys it. The routes
// and the scheduled run both ask here, so they can't drift apart.
function loginIsMounted(config: AppConfig): boolean {
  return config.APP_ENV === "development";
}

// What the Worker's daily Cron Trigger runs: deletes the login's expired rows
// (docs/adr/2026-11-25-how-long-login-rows-live.md). Where the login isn't
// mounted it returns at once, without opening a database client, so the cron
// never wakes a database whose tables may not exist.
export function createScheduledWork(
  variables: unknown,
  database: DatabaseSource,
): (now?: Date) => Promise<void> {
  const config = parseConfig(variables);
  if (!loginIsMounted(config)) return async () => {};

  return async (now = new Date()) => {
    try {
      const deleted = await withDatabase(database, (db) => deleteExpiredLoginRows(db, now));
      // Counts only: never a key, an address, a code or a token.
      console.log(
        `Deleted expired login rows: request limits ${deleted.requestLimits}, codes ${deleted.codes}, sessions ${deleted.sessions}`,
      );
    } catch (error) {
      console.error(`Deleting expired login rows failed: ${loggableError(error)}`);
      // Rethrown, so Cloudflare records the run as failed.
      throw error;
    }
  };
}
