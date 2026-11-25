import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export type TestPostgres = { connectionString: string; stop: () => Promise<void> };

const MIGRATIONS = new URL("../drizzle", import.meta.url).pathname;

// A real Postgres for the tests, with no account and no network: PGlite runs
// in this process, and the socket server speaks the wire protocol on a free
// local port, so the code under test connects with the real `pg` client.
// It starts with the committed migrations applied, so every test that uses it
// also proves they work.
// maxConnections stays above 1: the server forgets a closed connection only on
// the next tick, and a request right after another would be refused.
export async function startTestPostgres(): Promise<TestPostgres> {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0, maxConnections: 10 });
  await server.start();
  const connectionString = `postgres://postgres@${server.getServerConn()}/postgres`;

  const client = new Client({ connectionString });
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
  await client.end();

  return {
    connectionString,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
