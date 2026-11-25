import type { WebConfig } from "../config/config.ts";

// The sign-in page answers only where the API mounts its /login routes, which
// is development; anywhere else it is 404. Keep it in step with the
// APP_ENV check in apps/api/src/app.ts.
export function signInShown(environment: WebConfig["environment"]): boolean {
  return environment === "development";
}
