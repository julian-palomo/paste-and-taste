import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp, noDatabase } from "../src/app.ts";
import { createResendCodeSender } from "../src/login/resend-code-sender.ts";
import {
  cookieHeader,
  json,
  LOGIN_SETTINGS,
  loginApp,
  recordingSender,
  setCookies,
} from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

type SignedIn = { user: { id: string; email: string; name: string } };

const SESSION = "better-auth.session_token";
const NINETY_DAYS = 90 * 24 * 60 * 60;

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

// When the newest session of that address expires, in milliseconds since the
// epoch. Postgres converts it: the column is a timestamp without a time zone,
// holding UTC, and pg would read it in this machine's zone.
async function sessionExpiry(email: string): Promise<number> {
  const [row] = await query<{ ms: number }>(
    `select extract(epoch from s.expires_at)::float8 * 1000 as ms
       from session s join "user" u on u.id = s.user_id
      where u.email = $1 order by s.created_at desc limit 1`,
    [email],
  );
  return row?.ms ?? 0;
}

// Each test uses its own address and IP, so the limits of one never touch another.
let next = 0;
function someone() {
  next += 1;
  return { email: `person-${next}@example.com`, ip: `198.51.100.${next}` };
}

function setup() {
  const recorder = recordingSender();
  return { ...recorder, app: loginApp(postgres, recorder.sender) };
}

async function askForCode(app: ReturnType<typeof setup>["app"], email: string, ip: string) {
  return app.request("/login/code", json({ email }, { "cf-connecting-ip": ip }));
}

async function signIn(
  app: ReturnType<typeof setup>["app"],
  email: string,
  code: string,
  ip: string,
  rememberMe = false,
) {
  return app.request(
    "/login/sign-in",
    json({ email, code, rememberMe }, { "cf-connecting-ip": ip }),
  );
}

describe("a code by email", () => {
  it("hands the sender a 6-digit code for that address, and never stores the code itself", async () => {
    const { app, sent } = setup();
    const { email, ip } = someone();

    const response = await askForCode(app, email, ip);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(sent).toEqual([{ email, code: expect.stringMatching(/^\d{6}$/), language: "en" }]);
    const rows = await query<{ value: string }>(
      "select value from verification where identifier = $1",
      [`sign-in-otp-${email}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).not.toContain(sent[0]?.code);
  });

  it("signs in with one session cookie, and the session reads back that user", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);

    const signedIn = await signIn(app, email, lastCodeFor(email) ?? "", ip);
    const sessionCookies = signedIn.headers
      .getSetCookie()
      .filter((cookie) => cookie.startsWith(`${SESSION}=`));
    const body = await signedIn.json();
    const session = await app.request("/login/session", {
      headers: { cookie: cookieHeader(signedIn) },
    });

    expect(signedIn.status).toBe(200);
    expect(body).toEqual({ user: { id: expect.any(String), email, name: "" } });
    expect(sessionCookies).toHaveLength(1);
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual(body);
  });

  it("refuses a wrong code, and after three wrong ones the right one stops working", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);
    const code = lastCodeFor(email) ?? "";
    const wrong = code === "000000" ? "111111" : "000000";

    const attempts = [];
    for (let i = 0; i < 3; i++) attempts.push(await signIn(app, email, wrong, ip));
    const right = await signIn(app, email, code, ip);

    for (const attempt of attempts) {
      expect(attempt.status).toBe(401);
      expect(attempt.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    }
    expect(right.status).toBe(401);
  });

  it("refuses a code after its 300 seconds", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 301_000);

    const response = await signIn(app, email, lastCodeFor(email) ?? "", ip);

    expect(response.status).toBe(401);
  });

  it("reaches the same user when the same address signs in twice", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();

    await askForCode(app, email, ip);
    const first = await ((
      await signIn(app, email, lastCodeFor(email) ?? "", ip)
    ).json() as Promise<SignedIn>);
    await askForCode(app, email, ip);
    const second = await ((
      await signIn(app, email, lastCodeFor(email) ?? "", ip)
    ).json() as Promise<SignedIn>);

    expect(second.user.id).toBe(first.user.id);
  });
});

describe("the code's language and sending", () => {
  it("hands the sender the language asked for, and English when none is", async () => {
    const { app, sent } = setup();
    const spanish = someone();
    const none = someone();

    await app.request(
      "/login/code",
      json({ email: spanish.email, language: "es" }, { "cf-connecting-ip": spanish.ip }),
    );
    await askForCode(app, none.email, none.ip);

    expect(sent.map(({ email, language }) => ({ email, language }))).toEqual([
      { email: spanish.email, language: "es" },
      { email: none.email, language: "en" },
    ]);
  });

  it("answers 502 when Resend refuses the code, and logs none of its secrets", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const key = "re_test_key_never_real";
    const app = createApp(
      { APP_ENV: "development", ...LOGIN_SETTINGS },
      { connectionString: () => postgres.connectionString },
      {
        codeSender: createResendCodeSender({
          apiKey: key,
          fetch: async () =>
            new Response(JSON.stringify({ name: "invalid_parameter" }), { status: 422 }),
        }),
      },
    );
    const { email, ip } = someone();

    const response = await askForCode(app, email, ip);
    const logged = error.mock.calls.map((call) => call.map(String).join(" ")).join("\n");

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(logged).not.toContain(email);
    expect(logged).not.toContain(key);
    expect(logged).not.toMatch(/\b\d{6}\b/);
  });

  it("prints the code in development when no key and no sender are given", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = createApp(
      { APP_ENV: "development", ...LOGIN_SETTINGS },
      { connectionString: () => postgres.connectionString },
    );
    const { email, ip } = someone();

    const response = await askForCode(app, email, ip);

    expect(response.status).toBe(200);
    expect(log.mock.calls.flat().join(" ")).toMatch(/Sign-in code for .+: \d{6}/);
  });

  it("answers an error, not sent, when the sender fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = {
      send: async () => {
        throw new Error("the sender failed");
      },
    };
    const app = createApp(
      { APP_ENV: "development", ...LOGIN_SETTINGS },
      { connectionString: () => postgres.connectionString },
      { codeSender: failing },
    );
    const { email, ip } = someone();

    const response = await askForCode(app, email, ip);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  });
});

describe("Mantener la sesión iniciada", () => {
  it("without the box, the cookie has no expiry and the session row lasts a day", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);

    const response = await signIn(app, email, lastCodeFor(email) ?? "", ip, false);
    const cookies = setCookies(response);
    const session = cookies.get(SESSION) ?? "";
    const expiresAt = await sessionExpiry(email);

    expect(response.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION}=`))).toHaveLength(
      1,
    );
    expect(session).not.toMatch(/Max-Age|Expires/i);
    expect(cookies.has("better-auth.dont_remember")).toBe(true);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
  });

  it("with the box, the cookie lasts 90 days", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);

    const response = await signIn(app, email, lastCodeFor(email) ?? "", ip, true);

    expect(response.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION}=`))).toHaveLength(
      1,
    );
    expect(setCookies(response).get(SESSION)).toContain(`Max-Age=${NINETY_DAYS}`);
  });

  it("with the box, reading the session after a day renews it for another 90 days", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);
    const signedIn = await signIn(app, email, lastCodeFor(email) ?? "", ip, true);
    const before = await sessionExpiry(email);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const session = await app.request("/login/session", {
      headers: { cookie: cookieHeader(signedIn) },
    });
    const after = await sessionExpiry(email);

    expect(session.status).toBe(200);
    expect(setCookies(session).get(SESSION)).toContain(`Max-Age=${NINETY_DAYS}`);
    expect(after).toBeGreaterThan(before);
  });

  it("without the box, reading the session never renews it", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);
    const signedIn = await signIn(app, email, lastCodeFor(email) ?? "", ip, false);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);

    const session = await app.request("/login/session", {
      headers: { cookie: cookieHeader(signedIn) },
    });

    expect(session.status).toBe(200);
    expect(setCookies(session).has(SESSION)).toBe(false);
  });
});

describe("a request body that isn't valid", () => {
  it("answers 400 Problem Details", async () => {
    const { app } = setup();

    const response = await app.request("/login/code", json({ email: "not an address" }));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  });
});

describe("the session", () => {
  it("answers 401 with no session", async () => {
    const { app } = setup();

    const response = await app.request("/login/session");

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  });

  it("signs out, after which the session is gone", async () => {
    const { app, lastCodeFor } = setup();
    const { email, ip } = someone();
    await askForCode(app, email, ip);
    const signedIn = await signIn(app, email, lastCodeFor(email) ?? "", ip);
    const cookie = cookieHeader(signedIn);

    const out = await app.request("/login/sign-out", { method: "POST", headers: { cookie } });
    const session = await app.request("/login/session", { headers: { cookie } });

    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ signedOut: true });
    expect(session.status).toBe(401);
  });
});

describe("limits", () => {
  it("answers 429 to a fourth code for the same address within 15 minutes", async () => {
    const { app } = setup();
    const { email } = someone();

    const answers = [];
    for (let i = 0; i < 4; i++) {
      answers.push((await askForCode(app, email, someone().ip)).status);
    }

    expect(answers).toEqual([200, 200, 200, 429]);
  });

  it("answers 429 to an eleventh code from the same IP within an hour", async () => {
    const { app } = setup();
    const { ip } = someone();

    const answers = [];
    for (let i = 0; i < 11; i++) {
      answers.push((await askForCode(app, someone().email, ip)).status);
    }

    expect(answers.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(answers[10]).toBe(429);
  });

  it("answers 429 to a sixty-first sign-in from the same IP within an hour", async () => {
    const { app } = setup();
    const { email, ip } = someone();

    const answers = [];
    for (let i = 0; i < 61; i++) answers.push((await signIn(app, email, "000000", ip)).status);

    expect(answers.slice(0, 60).every((status) => status === 401)).toBe(true);
    expect(answers[60]).toBe(429);
  });
});

describe("where login exists", () => {
  const routes: [string, string][] = [
    ["POST", "/login/code"],
    ["POST", "/login/sign-in"],
    ["GET", "/login/session"],
    ["POST", "/login/sign-out"],
    ["POST", "/login/passkey/registration-options"],
    ["POST", "/login/passkey/registration"],
    ["POST", "/login/passkey/sign-in-options"],
    ["POST", "/login/passkey/sign-in"],
  ];

  it.each(["preview", "production"] as const)(
    "answers 404 for every login route in %s",
    async (env) => {
      const app = loginApp(postgres, recordingSender().sender, env);

      for (const [method, path] of routes) {
        const response = await app.request(path, { method });
        expect(response.status, `${method} ${path}`).toBe(404);
        expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
      }
    },
  );

  it("answers 503 and names what is missing when the login settings are not set", async () => {
    const app = createApp({ APP_ENV: "development" }, noDatabase);

    const response = await app.request("/login/session");
    const body = (await response.json()) as { detail: string };

    expect(response.status).toBe(503);
    expect(body.detail).toContain("BETTER_AUTH_SECRET");
  });
});
