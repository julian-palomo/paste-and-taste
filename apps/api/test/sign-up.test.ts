import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { invite, uninvite } from "../src/login/invited-address.repository.ts";
import { LIMITS } from "../src/login/request-limiter.ts";
import { json, LOGIN_SETTINGS, recordingSender } from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: postgres.connectionString });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function invited(email: string) {
  const client = new Client({ connectionString: postgres.connectionString });
  await client.connect();
  try {
    await invite(drizzle(client), email);
  } finally {
    await client.end();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

function appWith(signUp: "invited" | "open", options: { codesPerDay?: number } = {}) {
  const sender = recordingSender();
  const app = createApp(
    { APP_ENV: "development", ...LOGIN_SETTINGS, SIGN_UP: signUp },
    { connectionString: () => postgres.connectionString },
    { codeSender: sender.sender, ...options },
  );
  return { app, sender };
}

// Each request from its own IP, so the per-IP limits of one test never touch another.
let next = 0;
function fromNewIp() {
  next += 1;
  return { "cf-connecting-ip": `198.51.100.${next}` };
}

async function askForCode(app: ReturnType<typeof appWith>["app"], email: string) {
  const response = await app.request("/login/code", json({ email }, fromNewIp()));
  return { status: response.status, body: await response.json() };
}

// The body is the signed-in user, or Problem Details on a refusal.
type SignInAnswer = { status: number; body: { user?: { email: string } } };

async function signIn(
  app: ReturnType<typeof appWith>["app"],
  email: string,
  code: string,
): Promise<SignInAnswer> {
  const response = await app.request(
    "/login/sign-in",
    json({ email, code, rememberMe: false }, fromNewIp()),
  );
  return { status: response.status, body: (await response.json()) as SignInAnswer["body"] };
}

// An account made the way any user's is: a code, then signing in with it.
async function accountFor(email: string) {
  const { app, sender } = appWith("open");
  await askForCode(app, email);
  await signIn(app, email, sender.lastCodeFor(email) ?? "");
}

describe("sign-up by invitation", () => {
  it("sends a code to an address that has an account", async () => {
    const member = "member@example.com";
    await accountFor(member);
    const { app, sender } = appWith("invited");

    const asked = await askForCode(app, member);

    expect(asked).toEqual({ status: 200, body: { sent: true } });
    expect(sender.sent.map((s) => s.email)).toEqual([member]);
  });

  it("sends a code to an invited address, makes its account on sign-in, and forgets the invitation", async () => {
    const guest = "Guest@Example.com";
    await invited(guest);
    const { app, sender } = appWith("invited");

    const asked = await askForCode(app, guest);
    const signedIn = await signIn(app, guest, sender.lastCodeFor("guest@example.com") ?? "");

    expect(asked).toEqual({ status: 200, body: { sent: true } });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user?.email).toBe("guest@example.com");
    expect(
      await query("select email from invited_address where email = $1", ["guest@example.com"]),
    ).toEqual([]);
  });

  it("answers an address that is neither invited nor an account as if sent, and sends nothing", async () => {
    const member = "member-for-stranger@example.com";
    const stranger = "stranger@example.com";
    await accountFor(member);
    const { app, sender } = appWith("invited");

    const asked = await askForCode(app, stranger);
    const strangerSignIn = await signIn(app, stranger, "123456");
    const wrongCode = await signIn(app, member, "000000");

    expect(asked).toEqual({ status: 200, body: { sent: true } });
    expect(sender.sent).toEqual([]);
    expect(
      await query("select 1 from verification where identifier like $1", [`%${stranger}%`]),
    ).toEqual([]);
    expect(strangerSignIn.status).toBe(401);
    expect(strangerSignIn).toEqual(wrongCode);
    expect(await query('select 1 from "user" where email = $1', [stranger])).toEqual([]);
  });

  it("refuses a valid code for an address taken off the list, and makes no account", async () => {
    const guest = "removed-guest@example.com";
    await invited(guest);
    const { app, sender } = appWith("invited");
    await askForCode(app, guest);
    const client = new Client({ connectionString: postgres.connectionString });
    await client.connect();
    await uninvite(drizzle(client), guest);
    await client.end();

    const signedIn = await signIn(app, guest, sender.lastCodeFor(guest) ?? "");

    expect(signedIn.status).toBe(401);
    expect(await query('select 1 from "user" where email = $1', [guest])).toEqual([]);
  });

  it("gives a member, an invited address and a stranger the same answer", async () => {
    const member = "member-for-three@example.com";
    const guest = "guest-for-three@example.com";
    await accountFor(member);
    await invited(guest);
    const { app, sender } = appWith("invited");

    const answers = [
      await askForCode(app, member),
      await askForCode(app, guest),
      await askForCode(app, "stranger-for-three@example.com"),
    ];

    expect(answers[0]).toEqual({ status: 200, body: { sent: true } });
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(sender.sent.map((s) => s.email)).toEqual([member, guest]);
  });
});

describe("open sign-up", () => {
  it("sends a code to an unknown address, as before", async () => {
    const { app, sender } = appWith("open");

    const asked = await askForCode(app, "anyone@example.com");

    expect(asked).toEqual({ status: 200, body: { sent: true } });
    expect(sender.sent.map((s) => s.email)).toEqual(["anyone@example.com"]);
  });
});

describe("a missing sign-up value", () => {
  it("is treated as invited", async () => {
    const sender = recordingSender();
    const { SIGN_UP: _, ...withoutSignUp } = LOGIN_SETTINGS;
    const app = createApp(
      { APP_ENV: "development", ...withoutSignUp },
      { connectionString: () => postgres.connectionString },
      { codeSender: sender.sender },
    );

    await askForCode(app, "unknown-when-missing@example.com");

    expect(sender.sent).toEqual([]);
  });
});

// The ceiling counts the whole app, so each test starts from an empty count.
describe("the daily ceiling on codes", () => {
  async function freshCeiling() {
    await query("delete from request_limit where key like 'code:day:%'");
  }

  function warnings() {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    return () => spy.mock.calls.map((call) => call.map(String).join(" "));
  }

  it("sends no code past the ceiling, answers 429, and logs it once without an address", async () => {
    await freshCeiling();
    const logged = warnings();
    const { app, sender } = appWith("open", { codesPerDay: 2 });

    const answers = [];
    for (const n of [1, 2, 3, 4]) answers.push(await askForCode(app, `ceiling-${n}@example.com`));

    expect(answers.map((a) => a.status)).toEqual([200, 200, 429, 429]);
    expect(answers[2]?.body).toMatchObject({ status: 429, title: "Too Many Requests" });
    expect(sender.sent).toHaveLength(2);
    expect(logged()).toEqual([
      "The ceiling of 2 sign-in codes a day is reached; no more are sent until its window ends.",
    ]);
  });

  it("doesn't count requests for addresses that get no code", async () => {
    await freshCeiling();
    for (const guest of ["first-guest@example.com", "second-guest@example.com"])
      await invited(guest);
    const { app, sender } = appWith("invited", { codesPerDay: 2 });

    for (const n of [1, 2, 3, 4, 5]) await askForCode(app, `not-invited-${n}@example.com`);
    await askForCode(app, "first-guest@example.com");
    await askForCode(app, "second-guest@example.com");

    expect(sender.sent.map((s) => s.email)).toEqual([
      "first-guest@example.com",
      "second-guest@example.com",
    ]);
  });

  it("answers a stranger the same 429 as a member once the ceiling is full", async () => {
    await freshCeiling();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const guest of ["full-1@example.com", "full-2@example.com", "full-3@example.com"]) {
      await invited(guest);
    }
    const { app } = appWith("invited", { codesPerDay: 2 });
    await askForCode(app, "full-1@example.com");
    await askForCode(app, "full-2@example.com");

    // Exactly two codes sent: the stranger asks before any member is refused.
    const stranger = await askForCode(app, "stranger-at-ceiling@example.com");
    const member = await askForCode(app, "full-3@example.com");

    expect(stranger.status).toBe(429);
    expect(stranger).toEqual(member);
  });

  it("is set under Resend's free 100 a day, even across two windows back to back", () => {
    // The window starts at its first code, so two windows can meet inside
    // any 24 hours: at most twice the ceiling.
    expect(LIMITS.codesPerDay.windowMs).toBe(24 * 60 * 60 * 1000);
    expect(2 * LIMITS.codesPerDay.max).toBeLessThan(100);
  });

  it("counts from nothing again once its window has ended, for a stranger as for a member", async () => {
    await freshCeiling();
    await invited("next-day-guest@example.com");
    // Yesterday's window, full and ended 25 hours after it started.
    const started = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await query(
      "insert into request_limit (key, window_started_at, count) values ('code:day:all', $1::timestamp, 2)",
      [started],
    );
    const { app, sender } = appWith("invited", { codesPerDay: 2 });

    const stranger = await askForCode(app, "next-day-stranger@example.com");
    const member = await askForCode(app, "next-day-guest@example.com");

    expect(stranger).toEqual({ status: 200, body: { sent: true } });
    expect(member).toEqual(stranger);
    expect(sender.sent.map((s) => s.email)).toEqual(["next-day-guest@example.com"]);
  });
});
