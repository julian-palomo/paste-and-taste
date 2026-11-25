import { createApiClient } from "@paste-and-taste/api-client";
import { describe, expect, it } from "vitest";
import { formResponse } from "../src/session/relay.ts";
import { clearPendingCookie, readPending } from "../src/sign-in/relay.ts";
import {
  changeAddress,
  passkeyRegistrationOptions,
  passkeySignIn,
  passkeySignInOptions,
  readSession,
  registerPasskey,
  type SignInDeps,
  sendCode,
  signIn,
  signOut,
} from "../src/sign-in/sign-in.ts";

// What the browser sent the web app's server.
const browser = {
  cookie: "better-auth.session_token=abc",
  "cf-connecting-ip": "203.0.113.7",
  "user-agent": "Test browser",
};

// Two cookies with their attributes, as the API's Set-Cookie writes them.
const first = "better-auth.session_token=new; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000";
const second = "better-auth.session_data=xyz; Path=/; HttpOnly; SameSite=Lax";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status < 400 ? "application/json" : "application/problem+json",
    },
  });
const problem = (status: number) =>
  json({ type: "about:blank", title: "Error", status, detail: "Detail." }, status);
const withCookies = (response: Response) => {
  response.headers.append("Set-Cookie", first);
  response.headers.append("Set-Cookie", second);
  return response;
};

const NOW = 1_700_000_000_000;
// The browser's answer to a WebAuthn ceremony, as JSON text.
const answer = '{"id":"k"}';

// An API that answers `answer` to every call, and keeps each request.
function api(answer: () => Response | Promise<Response>) {
  const requests: Request[] = [];
  const setCookies: string[] = [];
  const deps: SignInDeps = {
    client: createApiClient({
      baseUrl: "http://api.test",
      fetch: async (request) => {
        requests.push(request);
        return answer();
      },
    }),
    headers: browser,
    appendSetCookie: (cookie) => setCookies.push(cookie),
    now: () => NOW,
    shown: true,
    origin: "http://localhost:5173",
  };
  return { deps, requests, setCookies };
}

const user = { id: "u1", email: "ana@example.com", name: "Ana" };
const sent = { email: "ana@example.com", sentAt: NOW - 120_000 };

// Each function that calls the API, with what the API answers it on success.
const calls = [
  [
    "sendCode",
    { sent: true },
    (d: SignInDeps) => sendCode(d, { lang: "es", email: "ana@example.com" }),
  ],
  [
    "signIn",
    { user },
    (d: SignInDeps) => signIn(d, { lang: "es", code: "123456", remember: false, pending: sent }),
  ],
  ["signOut", { signedOut: true }, (d: SignInDeps) => signOut(d, { lang: "es" })],
  ["readSession", { user }, (d: SignInDeps) => readSession(d)],
  [
    "passkeyRegistrationOptions",
    { challenge: "c" },
    (d: SignInDeps) => passkeyRegistrationOptions(d),
  ],
  [
    "registerPasskey",
    { registered: true },
    (d: SignInDeps) => registerPasskey(d, { responseJson: answer }),
  ],
  ["passkeySignInOptions", { challenge: "c" }, (d: SignInDeps) => passkeySignInOptions(d)],
  [
    "passkeySignIn",
    { user },
    (d: SignInDeps) => passkeySignIn(d, { responseJson: answer, rememberMe: false }),
  ],
] as const;

describe.each(calls)("%s", (_, body, call) => {
  it("sends the browser's cookie, IP and user agent to the API", async () => {
    const { deps, requests } = api(() => json(body));

    await call(deps);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("cookie")).toBe(browser.cookie);
    expect(requests[0]?.headers.get("cf-connecting-ip")).toBe(browser["cf-connecting-ip"]);
    expect(requests[0]?.headers.get("user-agent")).toBe(browser["user-agent"]);
  });

  it("hands each Set-Cookie of the API back to the browser, unchanged and in order", async () => {
    const { deps, setCookies } = api(() => withCookies(json(body)));

    await call(deps);

    expect(setCookies.slice(0, 2)).toEqual([first, second]);
  });

  it("sends no IP when the browser's request had none", async () => {
    const { deps, requests } = api(() => json(body));

    await call({ ...deps, headers: { cookie: browser.cookie } });

    expect(requests[0]?.headers.has("cf-connecting-ip")).toBe(false);
  });
});

describe("sendCode", () => {
  // The email goes out in the page's language, for the first code and for
  // "Enviar otro código", which posts to the same function.
  it.each([
    ["es", "the first code", undefined],
    ["en", "the first code", undefined],
    ["es", "another code", { email: "ana@example.com", sentAt: NOW - 61_000 }],
    ["en", "another code", { email: "ana@example.com", sentAt: NOW - 61_000 }],
  ] as const)("from a %s page, asks for %s in that language", async (lang, _, pending) => {
    const { deps, requests } = api(() => json({ sent: true }));

    await sendCode(deps, { lang, email: "ana@example.com", pending });

    expect(await requests[0]?.json()).toEqual({ email: "ana@example.com", language: lang });
  });

  it("asks the API for a code, remembers the address and goes to the code step", async () => {
    const { deps, requests, setCookies } = api(() => json({ sent: true }));

    const result = await sendCode(deps, { lang: "es", email: "ana@example.com" });

    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/login/code");
    expect(await requests[0]?.json()).toEqual({ email: "ana@example.com", language: "es" });
    expect(readPending(setCookies.at(-1)?.split(";")[0])).toEqual({
      email: "ana@example.com",
      sentAt: NOW,
    });
    expect(result).toEqual({ redirect: "/es/sign-in" });
  });

  it.each([
    [400, "invalid-email"],
    [502, "code-not-sent"],
    [429, "too-many-codes"],
    [503, "unreachable"],
  ])("on a %i, goes back with ?error=%s and keeps the typed address", async (status, kind) => {
    const { deps, setCookies } = api(() => problem(status));

    const result = await sendCode(deps, { lang: "en", email: "ana@" });

    expect(result).toEqual({ redirect: `/en/sign-in?error=${kind}` });
    expect(readPending(setCookies.at(-1)?.split(";")[0])).toEqual({ email: "ana@" });
  });

  it("refuses to send again within 60 seconds, without calling the API", async () => {
    const { deps, requests } = api(() => json({ sent: true }));

    const result = await sendCode(deps, {
      lang: "es",
      email: "ana@example.com",
      pending: { email: "ana@example.com", sentAt: NOW - 59_999 },
    });

    expect(requests).toHaveLength(0);
    expect(result).toEqual({ redirect: "/es/sign-in?error=too-soon" });
  });

  it("sends again from 60 seconds on", async () => {
    const { deps, requests } = api(() => json({ sent: true }));

    const result = await sendCode(deps, {
      lang: "es",
      email: "ana@example.com",
      pending: { email: "ana@example.com", sentAt: NOW - 60_000 },
    });

    expect(requests).toHaveLength(1);
    expect(result).toEqual({ redirect: "/es/sign-in" });
  });
});

describe("signIn", () => {
  it.each([
    [true, true],
    [false, false],
  ])("with the box ticked %s, sends rememberMe: %s", async (remember, rememberMe) => {
    const { deps, requests } = api(() => json({ user }));

    await signIn(deps, { lang: "es", code: "123456", remember, pending: sent });

    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/login/sign-in");
    expect(await requests[0]?.json()).toEqual({
      email: "ana@example.com",
      code: "123456",
      rememberMe,
    });
  });

  it("deletes the pending address and offers a passkey", async () => {
    const { deps, setCookies } = api(() => json({ user }));

    const result = await signIn(deps, {
      lang: "es",
      code: "123456",
      remember: false,
      pending: sent,
    });

    expect(setCookies).toContain(clearPendingCookie({ secure: false }));
    expect(result).toEqual({ redirect: "/es/sign-in?step=passkey" });
  });

  it.each([
    [401, "wrong-code"],
    [429, "too-many"],
    [503, "unreachable"],
  ])("on a %i, goes back with ?error=%s and keeps the address", async (status, kind) => {
    const { deps, setCookies } = api(() => problem(status));

    const result = await signIn(deps, {
      lang: "en",
      code: "000000",
      remember: false,
      pending: sent,
    });

    expect(result).toEqual({ redirect: `/en/sign-in?error=${kind}` });
    expect(setCookies).not.toContain(clearPendingCookie({ secure: false }));
  });

  it("with no address sent a code, starts again without calling the API", async () => {
    const { deps, requests } = api(() => json({ user }));

    const result = await signIn(deps, { lang: "es", code: "123456", remember: false });

    expect(requests).toHaveLength(0);
    expect(result).toEqual({ redirect: "/es/sign-in?error=start-again" });
  });
});

describe("changeAddress", () => {
  it("deletes the pending address and goes back to the address step", () => {
    const { deps, requests, setCookies } = api(() => json({}));

    const result = changeAddress(deps, { lang: "en" });

    expect(requests).toHaveLength(0);
    expect(setCookies).toEqual([clearPendingCookie({ secure: false })]);
    expect(result).toEqual({ redirect: "/en/sign-in" });
  });
});

describe("signOut", () => {
  it.each([
    ["signed out", () => json({ signedOut: true })],
    ["already signed out (401)", () => problem(401)],
  ])("when %s, goes back to the address step", async (_, answer) => {
    const { deps } = api(answer);

    expect(await signOut(deps, { lang: "es" })).toEqual({ redirect: "/es/sign-in" });
  });

  it("when the API can't sign out, says so", async () => {
    const { deps } = api(() => problem(503));

    expect(await signOut(deps, { lang: "es" })).toEqual({
      redirect: "/es/sign-in?error=unreachable",
    });
  });
});

describe("readSession", () => {
  it("is the signed-in user", async () => {
    const { deps } = api(() => json({ user }));

    expect(await readSession(deps)).toEqual({ kind: "signed-in", user });
  });

  it("is signed out on a 401", async () => {
    const { deps } = api(() => problem(401));

    expect(await readSession(deps)).toEqual({ kind: "signed-out" });
  });

  it("is unreachable when the API is", async () => {
    const { deps } = api(() => problem(503));

    expect(await readSession(deps)).toEqual({ kind: "unreachable" });
  });
});

describe("passkeys", () => {
  it("pass the API's options through as they are", async () => {
    const options = { challenge: "c", rp: { id: "localhost" } };
    const { deps } = api(() => json(options));

    expect(await passkeyRegistrationOptions(deps)).toEqual({ ok: true, options });
    expect(await passkeySignInOptions(deps)).toEqual({ ok: true, options });
  });

  it.each([
    [true, true],
    [false, false],
  ])("signing in with the box ticked %s sends rememberMe: %s", async (rememberMe, sentValue) => {
    const { deps, requests } = api(() => json({ user }));

    await passkeySignIn(deps, { responseJson: answer, rememberMe });

    expect(await requests[0]?.json()).toEqual({ response: { id: "k" }, rememberMe: sentValue });
  });

  // Creating a passkey and signing in with one fail in words of their own.
  it.each([
    ["a refused registration (400)", 400, "passkey-not-created"],
    ["a registration with no session (401)", 401, "passkey-not-created"],
    ["too many requests", 429, "too-many"],
    ["an API that is down", 503, "unreachable"],
  ])("registering: %s is %s", async (_, status, error) => {
    const { deps } = api(() => problem(status));

    expect(await registerPasskey(deps, { responseJson: answer })).toEqual({ ok: false, error });
  });

  it("asking for registration options with no session (401) is passkey-not-created", async () => {
    const { deps } = api(() => problem(401));

    expect(await passkeyRegistrationOptions(deps)).toEqual({
      ok: false,
      error: "passkey-not-created",
    });
  });

  it.each([
    ["a refused sign-in (401)", 401, "passkey-failed"],
    ["too many requests", 429, "too-many"],
    ["an API that is down", 503, "unreachable"],
  ])("signing in: %s is %s", async (_, status, error) => {
    const { deps } = api(() => problem(status));

    expect(await passkeySignIn(deps, { responseJson: answer, rememberMe: false })).toEqual({
      ok: false,
      error,
    });
  });

  it.each(["not json", "[]", "null", '"text"'])(
    "an answer that isn't a JSON object (%s) calls nothing and fails in each one's words",
    async (responseJson) => {
      const { deps, requests } = api(() => json({ registered: true }));

      expect(await registerPasskey(deps, { responseJson })).toEqual({
        ok: false,
        error: "passkey-not-created",
      });
      expect(await passkeySignIn(deps, { responseJson, rememberMe: false })).toEqual({
        ok: false,
        error: "passkey-failed",
      });
      expect(requests).toHaveLength(0);
    },
  );
});

describe("where the sign-in isn't shown", () => {
  const notShown = () => {
    const made = api(() => json({}));
    return { ...made, deps: { ...made.deps, shown: false } };
  };

  it.each([
    ["sendCode", (d: SignInDeps) => sendCode(d, { lang: "es", email: "ana@example.com" })],
    [
      "signIn",
      (d: SignInDeps) => signIn(d, { lang: "es", code: "123456", remember: false, pending: sent }),
    ],
    ["changeAddress", async (d: SignInDeps) => changeAddress(d, { lang: "es" })],
    ["signOut", (d: SignInDeps) => signOut(d, { lang: "es" })],
  ])("%s calls nothing, sets nothing, and is not found", async (_, call) => {
    const { deps, requests, setCookies } = notShown();

    expect(await call(deps)).toEqual({ notFound: true });
    expect(requests).toHaveLength(0);
    expect(setCookies).toEqual([]);
  });

  it.each([
    ["passkeyRegistrationOptions", (d: SignInDeps) => passkeyRegistrationOptions(d)],
    ["registerPasskey", (d: SignInDeps) => registerPasskey(d, { responseJson: answer })],
    ["passkeySignInOptions", (d: SignInDeps) => passkeySignInOptions(d)],
    [
      "passkeySignIn",
      (d: SignInDeps) => passkeySignIn(d, { responseJson: answer, rememberMe: false }),
    ],
  ])("%s calls nothing and fails", async (_, call) => {
    const { deps, requests } = notShown();

    expect(await call(deps)).toMatchObject({ ok: false });
    expect(requests).toHaveLength(0);
  });

  it("readSession calls nothing and is signed out", async () => {
    const { deps, requests } = notShown();

    expect(await readSession(deps)).toEqual({ kind: "signed-out" });
    expect(requests).toHaveLength(0);
  });
});

describe("formResponse", () => {
  it("answers a redirect with 303, its address and every cookie in order", () => {
    const response = formResponse({ redirect: "/es/sign-in" }, [first, second]);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/es/sign-in");
    expect(response.headers.getSetCookie()).toEqual([first, second]);
  });

  it("answers not found with 404 and no cookie", () => {
    const response = formResponse({ notFound: true }, [first]);

    expect(response.status).toBe(404);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("the pending cookie's Secure", () => {
  it.each([
    ["https://web.test", true],
    ["http://localhost:5173", false],
  ])("on %s, sendCode and signIn write it with Secure: %s", async (origin, secure) => {
    const made = api(() => json({ sent: true, user }));
    const deps = { ...made.deps, origin };

    await sendCode(deps, { lang: "es", email: "ana@example.com" });
    await signIn(deps, { lang: "es", code: "123456", remember: false, pending: sent });

    const pendingCookies = made.setCookies.filter((c) => c.startsWith("sign_in_pending="));
    expect(pendingCookies).toHaveLength(2);
    for (const cookie of pendingCookies) {
      expect(cookie.split("; ").includes("Secure")).toBe(secure);
    }
  });
});
