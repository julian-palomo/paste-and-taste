import { afterAll, beforeAll, expect, it } from "vitest";
import { createPasskeyDevice } from "./authenticator.ts";
import {
  cookieHeader,
  json,
  LOGIN_SETTINGS,
  loginApp,
  recordingSender,
  setCookies,
} from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

const SESSION = "better-auth.session_token";
const NINETY_DAYS = 90 * 24 * 60 * 60;
const ceremony = (challenge: string) => ({
  challenge,
  rpId: LOGIN_SETTINGS.PASSKEY_RP_ID,
  origin: LOGIN_SETTINGS.PASSKEY_ORIGIN,
});

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

let next = 0;
async function signedInWithCode() {
  next += 1;
  const email = `passkey-${next}@example.com`;
  const ip = `203.0.113.${next}`;
  const recorder = recordingSender();
  const app = loginApp(postgres, recorder.sender);
  await app.request("/login/code", json({ email }, { "cf-connecting-ip": ip }));
  const signedIn = await app.request(
    "/login/sign-in",
    json(
      { email, code: recorder.lastCodeFor(email), rememberMe: false },
      { "cf-connecting-ip": ip },
    ),
  );
  const user = ((await signedIn.json()) as { user: { id: string } }).user;
  return { app, ip, user, cookie: cookieHeader(signedIn) };
}

async function registerPasskey() {
  const { app, ip, user, cookie } = await signedInWithCode();
  const device = createPasskeyDevice();
  const options = await app.request("/login/passkey/registration-options", {
    method: "POST",
    headers: { cookie, "cf-connecting-ip": ip },
  });
  const { challenge } = (await options.json()) as { challenge: string };
  const registered = await app.request(
    "/login/passkey/registration",
    json(
      { response: device.register(ceremony(challenge)) },
      { cookie: `${cookie}; ${cookieHeader(options)}`, "cf-connecting-ip": ip },
    ),
  );
  return { app, ip, user, device, options, registered };
}

async function signInWithPasskey(
  setup: Awaited<ReturnType<typeof registerPasskey>>,
  { rememberMe = false, otherKey = false } = {},
) {
  const { app, ip, device } = setup;
  const options = await app.request("/login/passkey/sign-in-options", {
    method: "POST",
    headers: { "cf-connecting-ip": ip },
  });
  const { challenge } = (await options.json()) as { challenge: string };
  return app.request(
    "/login/passkey/sign-in",
    json(
      { response: device.signIn(ceremony(challenge), { otherKey }), rememberMe },
      { cookie: cookieHeader(options), "cf-connecting-ip": ip },
    ),
  );
}

it("registers a passkey for a signed-in user, who then signs in with it from no session", async () => {
  const setup = await registerPasskey();

  const signedIn = await signInWithPasskey(setup);
  const session = await setup.app.request("/login/session", {
    headers: { cookie: cookieHeader(signedIn) },
  });

  expect(setup.options.status).toBe(200);
  expect(setCookies(setup.options).size).toBeGreaterThan(0);
  expect(setup.registered.status).toBe(200);
  expect(await setup.registered.json()).toEqual({ registered: true });
  expect(signedIn.status).toBe(200);
  expect(((await session.json()) as { user: { id: string } }).user.id).toBe(setup.user.id);
});

it("refuses a passkey signature from another key with 401", async () => {
  const setup = await registerPasskey();

  const response = await signInWithPasskey(setup, { otherKey: true });

  expect(response.status).toBe(401);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
});

it("gives a passkey sign-in one session cookie: no expiry without the box, 90 days with it", async () => {
  const setup = await registerPasskey();

  const unticked = await signInWithPasskey(setup, { rememberMe: false });
  const ticked = await signInWithPasskey(setup, { rememberMe: true });

  for (const response of [unticked, ticked]) {
    expect(response.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION}=`))).toHaveLength(
      1,
    );
  }
  expect(setCookies(unticked).get(SESSION)).not.toMatch(/Max-Age|Expires/i);
  expect(setCookies(ticked).get(SESSION)).toContain(`Max-Age=${NINETY_DAYS}`);
});

it("answers 401 to registration options with no session", async () => {
  const { app } = await signedInWithCode();

  const response = await app.request("/login/passkey/registration-options", { method: "POST" });

  expect(response.status).toBe(401);
});
