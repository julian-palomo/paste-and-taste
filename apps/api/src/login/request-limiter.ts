import type { Database } from "../database/database.ts";
import { TooManyRequestsError } from "./login-errors.ts";
import { countRequest } from "./request-limit.repository.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export type LimitRule = { name: string; max: number; windowMs: number };

// The login's limits. The counts live in Postgres, never in a Worker's memory:
// each isolate has its own memory and Cloudflare drops isolates at will, so a
// count kept there promises nothing. Better Auth's own limiter never runs
// here, since the login calls Better Auth through auth.api, which skips it.
export const LIMITS = {
  // Enough to resend twice after the screen's wait, too few to flood an inbox.
  codePerAddress: { name: "code:email", max: 3, windowMs: 15 * MINUTE },
  // A household or an office shares an IP.
  codePerIp: { name: "code:ip", max: 10, windowMs: HOUR },
  // Every other login POST: signing in, and the passkey's options and verifies.
  loginPerIp: { name: "login:ip", max: 60, windowMs: HOUR },
} satisfies Record<string, LimitRule>;

export type RequestLimiter = {
  // Counts this request against the rule for `who`, and throws
  // TooManyRequestsError past the limit.
  check(db: Database, rule: LimitRule, who: string): Promise<void>;
};

export function createRequestLimiter(): RequestLimiter {
  return {
    async check(db, rule, who) {
      const count = await countRequest(db, `${rule.name}:${who}`, rule.windowMs, new Date());
      if (count > rule.max) throw new TooManyRequestsError();
    },
  };
}
