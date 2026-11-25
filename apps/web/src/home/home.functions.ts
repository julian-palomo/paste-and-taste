import { createApiClient } from "@paste-and-taste/api-client";
import { createServerFn } from "@tanstack/react-start";
import { withConfig } from "../config/config.middleware.ts";
import { readHealth } from "../health/read-health.ts";
import { homeOf } from "./home-of.ts";

// The home's data: the building page needs none, so it reads no health; the
// health home reads it as the health page does. The wake still runs on every
// page load, the building page's included (src/wake/wake.ts).
export const getHomePage = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .handler(async ({ context }) => {
    if (homeOf(context.config.environment) === "building") {
      return { kind: "building" as const, origin: context.origin };
    }
    const { baseUrl, fetch } = context.config.api;
    const client = createApiClient(fetch ? { baseUrl, fetch } : { baseUrl });
    return { kind: "health" as const, health: await readHealth(client), origin: context.origin };
  });
