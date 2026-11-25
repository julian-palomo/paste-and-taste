import { lt, lte } from "drizzle-orm";
import type { Database } from "../database/database.ts";
import { requestLimit, session, verification } from "../database/schema.ts";
import { LIMITS } from "./request-limiter.ts";

// A request limit's row past the longest window has ended its window under
// every rule, so countRequest would start it again at 1 either way: deleting
// it never resets a window that is still counting. A rule with a longer
// window raises this on its own.
const LONGEST_WINDOW_MS = Math.max(...Object.values(LIMITS).map((rule) => rule.windowMs));

type DeletedLoginRows = { requestLimits: number; codes: number; sessions: number };

// Deletes the login's rows that nothing needs any more
// (docs/adr/2026-11-25-how-long-login-rows-live.md). Codes and sessions use
// Better Auth's own test, `expiresAt < now`. Drizzle writes a Date as UTC
// text, as Better Auth's writes and countRequest do, so the machine's time
// zone doesn't matter.
export async function deleteExpiredLoginRows(db: Database, now: Date): Promise<DeletedLoginRows> {
  const limitCutoff = new Date(now.getTime() - LONGEST_WINDOW_MS);
  const requestLimits = await db
    .delete(requestLimit)
    .where(lte(requestLimit.windowStartedAt, limitCutoff))
    .returning({ key: requestLimit.key });
  const codes = await db
    .delete(verification)
    .where(lt(verification.expiresAt, now))
    .returning({ id: verification.id });
  const sessions = await db
    .delete(session)
    .where(lt(session.expiresAt, now))
    .returning({ id: session.id });
  return { requestLimits: requestLimits.length, codes: codes.length, sessions: sessions.length };
}
