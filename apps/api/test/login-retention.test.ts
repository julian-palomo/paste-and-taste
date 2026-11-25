import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduledWork, noDatabase } from "../src/app.ts";
import type { Database } from "../src/database/database.ts";
import { requestLimit, session, user, verification } from "../src/database/schema.ts";
import { deleteExpiredLoginRows } from "../src/login/expired-rows.repository.ts";
import { countRequest } from "../src/login/request-limit.repository.ts";
import { LOGIN_SETTINGS } from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = new Date("2026-11-25T03:17:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const later = (ms: number) => new Date(NOW.getTime() + ms);

let postgres: TestPostgres;
let client: Client;
let db: Database;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

beforeEach(async () => {
  client = new Client({ connectionString: postgres.connectionString });
  await client.connect();
  db = drizzle(client);
  await db.delete(requestLimit);
  await db.delete(verification);
  await db.delete(session);
  await db.delete(user);
  await db.insert(user).values({ id: "u1", name: "Ana", email: "ana@example.com" });
});

afterEach(async () => {
  await client.end();
  vi.restoreAllMocks();
});

async function addSession(id: string, expiresAt: Date) {
  await db
    .insert(session)
    .values({ id, token: `token-${id}`, userId: "u1", expiresAt, updatedAt: NOW });
}

async function addCode(id: string, expiresAt: Date) {
  await db
    .insert(verification)
    .values({ id, identifier: `sign-in-otp-${id}`, value: "482913:0", expiresAt });
}

async function addLimit(key: string, windowStartedAt: Date, count = 1) {
  await db.insert(requestLimit).values({ key, windowStartedAt, count });
}

const ids = async () => ({
  sessions: (await db.select({ id: session.id }).from(session)).map((r) => r.id).sort(),
  codes: (await db.select({ id: verification.id }).from(verification)).map((r) => r.id).sort(),
  limits: (await db.select({ key: requestLimit.key }).from(requestLimit)).map((r) => r.key).sort(),
});

describe("deleting the login's expired rows", () => {
  it("deletes an expired row of each table", async () => {
    await addSession("expired", ago(1000));
    await addCode("expired", ago(1000));
    // Exactly the longest window ago: ended under every rule.
    await addLimit("code:ip:203.0.113.7", ago(HOUR));

    const deleted = await deleteExpiredLoginRows(db, NOW);

    expect(deleted).toEqual({ requestLimits: 1, codes: 1, sessions: 1 });
    expect(await ids()).toEqual({ sessions: [], codes: [], limits: [] });
  });

  it("keeps a row of each table that hasn't expired", async () => {
    await addSession("at-now", NOW);
    await addSession("later", later(MINUTE));
    await addCode("at-now", NOW);
    await addCode("later", later(MINUTE));
    await addLimit("login:ip:203.0.113.7", ago(59 * MINUTE));

    const deleted = await deleteExpiredLoginRows(db, NOW);

    expect(deleted).toEqual({ requestLimits: 0, codes: 0, sessions: 0 });
    expect(await ids()).toEqual({
      sessions: ["at-now", "later"],
      codes: ["at-now", "later"],
      limits: ["login:ip:203.0.113.7"],
    });
  });

  it("never resets a window that is still counting", async () => {
    const start = ago(30 * MINUTE);
    await countRequest(db, "code:ip:203.0.113.7", HOUR, start);
    await countRequest(db, "code:ip:203.0.113.7", HOUR, start);

    await deleteExpiredLoginRows(db, NOW);

    expect(await countRequest(db, "code:ip:203.0.113.7", HOUR, NOW)).toBe(3);
  });

  it("changes nothing for a window that ended within the longest window", async () => {
    // A 15-minute window that ended 20 minutes ago: kept, and its next count
    // starts a new window, as it would with no deletion.
    await addLimit("code:email:ana@example.com", ago(35 * MINUTE), 3);

    await deleteExpiredLoginRows(db, NOW);

    expect((await ids()).limits).toEqual(["code:email:ana@example.com"]);
    expect(await countRequest(db, "code:email:ana@example.com", 15 * MINUTE, NOW)).toBe(1);
  });
});

// What the Worker's scheduled handler runs: worker.ts calls it in one line.
describe("the daily scheduled run", () => {
  it("deletes the expired rows where the login runs, logging counts only", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await addSession("expired", ago(1000));
    await addCode("expired", ago(1000));
    await addLimit("code:email:ana@example.com", ago(HOUR));
    await addLimit("code:ip:203.0.113.7", ago(HOUR));

    await createScheduledWork(
      { APP_ENV: "development", ...LOGIN_SETTINGS },
      { connectionString: () => postgres.connectionString },
    )(NOW);

    expect(await ids()).toEqual({ sessions: [], codes: [], limits: [] });
    const logged = log.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).toContain("request limits 2, codes 1, sessions 1");
    for (const secret of ["ana@example.com", "203.0.113.7", "482913", "token-expired"]) {
      expect(logged).not.toContain(secret);
    }
  });

  it.each(["preview", "production"] as const)(
    "touches no database in %s, where the login isn't mounted",
    async (env) => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      // noDatabase throws if anything connects.
      await createScheduledWork({ APP_ENV: env }, noDatabase)(NOW);

      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );
});
