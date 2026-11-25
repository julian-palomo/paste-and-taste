import type { WebConfig } from "../config/config.ts";

// What /en and /es show: the API's health where the people building the app
// look, the building page anywhere else. A list of the environments that show
// the health, so an environment added later shows the building page until it
// is listed here.
const healthIn: readonly WebConfig["environment"][] = ["development", "preview"];

export function homeOf(environment: WebConfig["environment"]): "health" | "building" {
  return healthIn.includes(environment) ? "health" : "building";
}
