import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

it("applies the committed migrations: Better Auth's tables, the request limits, the invited list and the recipes", async () => {
  const client = new Client({ connectionString: postgres.connectionString });
  await client.connect();
  const { rows } = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  await client.end();

  expect(rows.map((row) => row.table_name)).toEqual([
    "auth_account",
    "invited_address",
    "passkey",
    "recipe",
    "request_limit",
    "session",
    "user",
    "verification",
  ]);
});
