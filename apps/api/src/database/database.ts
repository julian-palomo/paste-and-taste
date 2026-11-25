import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { DatabaseUnavailableError } from "./database-unavailable-error.ts";

// Where the database is. The Workers entry reads the Hyperdrive binding inside
// this function, so the binding is read on each request, never at start-up.
export type DatabaseSource = { connectionString: () => string };

export type Database = NodePgDatabase;

// What a module receives: runs `work` with a database for one request.
export type WithDatabase = <T>(work: (db: Database) => Promise<T>) => Promise<T>;

// For an application that never reaches its database: the OpenAPI script, and
// tests of routes that don't touch it.
export const noDatabase: DatabaseSource = {
  connectionString: () => {
    throw new Error("This application was built without a database.");
  },
};

// Connecting and the work share this one deadline. Neon waking from sleep
// took up to 2.9 s in docs/research/login-on-workers.md; a limit below that
// would report a database that is only waking as down.
const DATABASE_TIMEOUT_MS = 5000;
// After a failure, closing gets at most this long, so a stuck close never
// holds the answer back.
const CLOSE_TIMEOUT_MS = 1000;

class DeadlinePassed extends Error {}

// Wraps what `connect` threw, so it can be told apart from what the work threw.
class ConnectFailed extends Error {}

// One client per call, closed before it returns. Never keep a client at module
// scope or share it between requests: on Workers, a request that waits on
// another request's connection hangs (docs/adr/2026-11-25-database-host-and-drizzle.md).
export async function withDatabase<T>(
  source: DatabaseSource,
  work: (db: Database) => Promise<T>,
  timeoutMs = DATABASE_TIMEOUT_MS,
): Promise<T> {
  const client = new Client({
    connectionString: source.connectionString(),
    connectionTimeoutMillis: timeoutMs,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlinePassed()), timeoutMs);
  });
  const running = (async () => {
    try {
      await client.connect();
    } catch (error) {
      throw new ConnectFailed("connect failed", { cause: error });
    }
    return work(drizzle(client));
  })();
  // When the deadline wins, `running` may still fail later; nobody awaits it.
  running.catch(() => {});

  let result: T;
  try {
    result = await Promise.race([running, deadline]);
  } catch (error) {
    await closeWithin(client, CLOSE_TIMEOUT_MS);
    // Only a failed connect or the deadline is the database being unavailable.
    // An error from the work is rethrown as it is: an AppError keeps its own
    // status, and anything else reaches onError as a 500. A connection that
    // drops in the middle of the work is reported that way too, as a 500.
    if (error instanceof DeadlinePassed) {
      console.error(error);
      throw DatabaseUnavailableError.timedOut(timeoutMs);
    }
    if (error instanceof ConnectFailed) {
      console.error(error.cause);
      throw DatabaseUnavailableError.unreachable();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  await client.end();
  return result;
}

async function closeWithin(client: Client, limitMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, limitMs);
  });
  try {
    await Promise.race([client.end().catch(() => {}), limit]);
  } finally {
    clearTimeout(timer);
  }
}
