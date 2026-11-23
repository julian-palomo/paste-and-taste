// One Better Auth instance for one request. Never hoist it to module scope:
// it holds the request's pg client, and a client shared between requests
// leaves the next ones hung until the runtime cancels them.

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

type AuthSettings = { secret: string; baseURL: string; basePath: string };

export function createAuth(db: NodePgDatabase<typeof schema>, settings: AuthSettings) {
  return betterAuth({
    ...settings,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    // Off so the run measures login's CPU time, not the limiter, which is on
    // by default in production and could answer 429 to a batch of sign-ins.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
  });
}
