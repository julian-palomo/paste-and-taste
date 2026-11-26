import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../src/database/database.ts";
import { inviteCommand } from "../src/login/invite-command.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

beforeEach(async () => {
  await withDb((db) => db.execute("delete from invited_address"));
});

async function withDb<T>(work: (db: Database) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: postgres.connectionString });
  await client.connect();
  try {
    return await work(drizzle(client));
  } finally {
    await client.end();
  }
}

const run = (action: string, address: string) => withDb((db) => inviteCommand(db, action, address));

const listed = () =>
  withDb(async (db) => {
    const { rows } = await db.execute<{ email: string }>(
      "select email from invited_address order by email",
    );
    return rows.map((row) => row.email);
  });

describe("the owner's invite command", () => {
  it("adds an address in lower case, and adding it twice changes nothing", async () => {
    expect(await run("add", "  Ana@Example.com ")).toBe("Invited.");
    expect(await run("add", "ana@example.com")).toBe("Invited.");

    expect(await listed()).toEqual(["ana@example.com"]);
  });

  it("removes an address, and says when it wasn't on the list", async () => {
    await run("add", "bea@example.com");

    expect(await run("remove", "BEA@example.com")).toBe("Removed.");
    expect(await run("remove", "bea@example.com")).toBe("Not on the list.");
    expect(await listed()).toEqual([]);
  });

  it("refuses what isn't an email address, and an unknown action, adding nothing", async () => {
    await expect(run("add", "not an address")).rejects.toThrow("That isn't an email address.");
    await expect(run("list", "ana@example.com")).rejects.toThrow(
      "Usage: pnpm -C apps/api invite add|remove",
    );
    expect(await listed()).toEqual([]);
  });

  it("never repeats the address it was given", async () => {
    const said = [
      await run("add", "cleo@example.com"),
      await run("remove", "cleo@example.com"),
      await run("remove", "cleo@example.com"),
      await run("add", "bad address").catch((error: Error) => error.message),
      await run("drop", "cleo@example.com").catch((error: Error) => error.message),
    ];

    for (const line of said) expect(line).not.toContain("cleo");
  });
});
