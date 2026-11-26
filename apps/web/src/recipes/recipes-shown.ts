import type { WebConfig } from "../config/config.ts";

// The recipe pages answer only where the API mounts its /recipes routes, which
// is development; anywhere else they are 404. Keep it in step with the
// APP_ENV check in apps/api/src/app.ts.
export function recipesShown(environment: WebConfig["environment"]): boolean {
  return environment === "development";
}
