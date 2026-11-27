import type { Database } from "../database/database.ts";
import { TooManyRequestsError } from "./login-errors.ts";
import { countRequest, readCount } from "./request-limit.repository.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// `ceiling` names what a ceiling for the whole app counts, and asks for one
// log line when it is reached.
export type LimitRule = { name: string; max: number; windowMs: number; ceiling?: string };

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
  // The codes sent in a day, for the whole app, counted as "all". The window
  // starts at its first code, so two windows back to back send at most 80 in
  // any 24 hours: under Resend's free 100 a day, whatever its own window
  // (docs/adr/2026-11-26-sign-up-by-invitation.md).
  codesPerDay: { name: "code:day", max: 40, windowMs: DAY, ceiling: "sign-in codes a day" },
} satisfies Record<string, LimitRule>;

export type RequestLimiter = {
  // Counts this request against the rule for `who`, and throws
  // TooManyRequestsError past the limit.
  check(db: Database, rule: LimitRule, who: string): Promise<void>;
  // Throws the same error when the rule's count is already full, without
  // counting this request. For a request that would spend nothing, so it
  // gets the answer a counted one would.
  reached(db: Database, rule: LimitRule, who: string): Promise<void>;
};

export function createRequestLimiter(): RequestLimiter {
  return {
    async check(db, rule, who) {
      const count = await countRequest(db, `${rule.name}:${who}`, rule.windowMs, new Date());
      if (count <= rule.max) return;
      // Once per window: the first count past the ceiling. Never an address.
      if (rule.ceiling && count === rule.max + 1) {
        console.warn(
          `The ceiling of ${rule.max} ${rule.ceiling} is reached; no more are sent until its window ends.`,
        );
      }
      throw new TooManyRequestsError();
    },

    async reached(db, rule, who) {
      const count = await readCount(db, `${rule.name}:${who}`, rule.windowMs, new Date());
      if (count >= rule.max) throw new TooManyRequestsError();
    },
  };
}
