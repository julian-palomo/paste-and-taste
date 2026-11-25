import { sql } from "drizzle-orm";
import type { Database } from "../database/database.ts";
import { requestLimit } from "../database/schema.ts";

// Counts one request for `key` and returns how many the key has made in its
// current window. One statement, so two requests at once can't both read the
// old count: Postgres serialises the upsert on the key.
// Times go in as UTC text cast to `timestamp`, the same way Drizzle writes the
// column, so the comparison doesn't depend on the machine's time zone.
export async function countRequest(
  db: Database,
  key: string,
  windowMs: number,
  now: Date,
): Promise<number> {
  const nowUtc = sql`${now.toISOString()}::timestamp`;
  const windowStart = sql`${new Date(now.getTime() - windowMs).toISOString()}::timestamp`;
  const expired = sql`${requestLimit.windowStartedAt} <= ${windowStart}`;

  const [row] = await db
    .insert(requestLimit)
    .values({ key, windowStartedAt: now, count: 1 })
    .onConflictDoUpdate({
      target: requestLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${requestLimit.count} + 1 end`,
        windowStartedAt: sql`case when ${expired} then ${nowUtc} else ${requestLimit.windowStartedAt} end`,
      },
    })
    .returning({ count: requestLimit.count });
  return row?.count ?? 1;
}
