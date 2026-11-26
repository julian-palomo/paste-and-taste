import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { invite, uninvite } from "../src/login/invited-address.repository.ts";
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

function appWith(signUp: "invited" | "open", sender = recordingSender()) {
  const app = createApp(
    { APP_ENV: "development", ...LOGIN_SETTINGS, SIGN_UP: signUp },
    { connectionString: () => postgres.connectionString },
    { codeSender: sender.sender },
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
