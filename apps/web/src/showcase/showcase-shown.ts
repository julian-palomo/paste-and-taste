import type { WebConfig } from "../config/config.ts";

// Where the showcase page answers; anywhere else it is 404. A list of the
// environments it is shown in, not of the ones it is hidden from, so an
// environment added later hides it until it is listed here.
const shownIn: readonly WebConfig["environment"][] = ["development", "preview"];

export function showcaseShown(environment: WebConfig["environment"]): boolean {
  return shownIn.includes(environment);
}
