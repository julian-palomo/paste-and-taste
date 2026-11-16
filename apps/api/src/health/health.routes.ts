import { Hono } from "hono";
import type { AppConfig } from "../config/config.schema";

type HealthDeps = { config: AppConfig };

// Checks nothing else yet: each dependency adds its own check when it arrives.
export function healthRoutes({ config }: HealthDeps): Hono {
  return new Hono().get("/", (c) => c.json({ status: "ok", environment: config.APP_ENV }));
}
