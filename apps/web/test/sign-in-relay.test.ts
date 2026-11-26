import { ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";
import { describe, expect, it } from "vitest";
import { relayHeaders } from "../src/session/relay.ts";
import {
  afterSignIn,
  clearPendingCookie,
  codeError,
  parseErrorKind,
  parseNext,
  passkeyError,
  pendingCookie,
  readPending,
  registrationError,
  signInError,
} from "../src/sign-in/relay.ts";
import { signInShown } from "../src/sign-in/sign-in-shown.ts";

const apiError = (status: number) =>
  new ApiError(status, { type: "about:blank", title: "Error", status, detail: "Detail." });

describe("relayHeaders", () => {
  it("takes the browser's cookie, IP and user agent, and nothing else", () => {
    const browser = new Headers({
      cookie: "session=abc",
      "cf-connecting-ip": "203.0.113.7",
      "user-agent": "Test browser",
      authorization: "Bearer not-ours",
      "x-forwarded-for": "198.51.100.1",
    });

    expect(relayHeaders((name) => browser.get(name) ?? undefined)).toEqual({
      cookie: "session=abc",
      "cf-connecting-ip": "203.0.113.7",
      "user-agent": "Test browser",
    });
  });

  // The web app's own cookies hold the address being signed in with and a
  // recipe's draft: they are the browser's business with the web app, never
  // the API's.
  it("passes the browser's cookies on without the web app's own", () => {
    const cookie =
      "better-auth.session_token=abc; sign_in_pending=%7B%7D; recipe_draft_0=x; recipe_draft_1=y; theme=dark";

    expect(relayHeaders((name) => (name === "cookie" ? cookie : undefined))).toEqual({
      cookie: "better-auth.session_token=abc; theme=dark",
    });
  });

  it("sends no cookie header when only the web app's own cookies are there", () => {
    expect(
      relayHeaders((name) =>
        name === "cookie" ? "sign_in_pending=x; recipe_draft_0=y" : undefined,
      ),
    ).toEqual({});
  });

  it("leaves out a header the browser didn't send", () => {
    expect(relayHeaders(() => undefined)).toEqual({});
  });
});

describe("the pending cookie", () => {
  it("is HttpOnly, SameSite=Lax, for the whole site, for 15 minutes", () => {
    const cookie = pendingCookie({ email: "ana@example.com", sentAt: 1000 }, { secure: false });

    expect(cookie).toMatch(/^sign_in_pending=[^;]+;/);
    expect(cookie.split("; ")).toEqual(
      expect.arrayContaining(["Path=/", "Max-Age=900", "HttpOnly", "SameSite=Lax"]),
    );
  });

  it("reads back what was written, among other cookies", () => {
    const value = pendingCookie(
      { email: "ana@example.com", sentAt: 1000 },
      { secure: false },
    ).split(";")[0];

    expect(readPending(`session=abc; ${value}; other=1`)).toEqual({
      email: "ana@example.com",
      sentAt: 1000,
    });
    expect(
      readPending(pendingCookie({ email: "ana@example.com" }, { secure: false }).split(";")[0]),
    ).toEqual({
      email: "ana@example.com",
    });
  });

  it.each([
    ["no cookie header", undefined],
    ["no such cookie", "session=abc"],
    ["a value that isn't JSON", "sign_in_pending=not-json"],
    ["JSON of another shape", `sign_in_pending=${encodeURIComponent('{"mail":"x"}')}`],
  ])("reads %s as none", (_, header) => {
    expect(readPending(header)).toBeUndefined();
  });

  it("is deleted by an expired cookie of the same name and path", () => {
    expect(clearPendingCookie({ secure: false }).split("; ")).toEqual(
      expect.arrayContaining(["sign_in_pending=", "Path=/", "Max-Age=0"]),
    );
  });

  it.each([
    [true, true],
    [false, false],
  ])("with secure: %s, is Secure: %s, and so is its delete", (secure, has) => {
    expect(
      pendingCookie({ email: "ana@example.com" }, { secure }).split("; ").includes("Secure"),
    ).toBe(has);
    expect(clearPendingCookie({ secure }).split("; ").includes("Secure")).toBe(has);
  });
});

describe("error kinds", () => {
  const unreachable = new ApiUnreachableError("The API could not be reached.");

  it.each([
    [apiError(400), "invalid-email"],
    [apiError(502), "code-not-sent"],
    [apiError(429), "too-many-codes"],
    [apiError(503), "unreachable"],
    [apiError(500), "unreachable"],
    [unreachable, "unreachable"],
  ])("asking for a code: %s is %s", (error, kind) => {
    expect(codeError(error)).toBe(kind);
  });

  it.each([
    [apiError(401), "wrong-code"],
    [apiError(429), "too-many"],
    [apiError(503), "unreachable"],
    [unreachable, "unreachable"],
  ])("signing in with a code: %s is %s", (error, kind) => {
    expect(signInError(error)).toBe(kind);
  });

  it.each([
    [apiError(400), "passkey-failed"],
    [apiError(401), "passkey-failed"],
    [apiError(429), "too-many"],
    [apiError(503), "unreachable"],
    [unreachable, "unreachable"],
  ])("a passkey: %s is %s", (error, kind) => {
    expect(passkeyError(error)).toBe(kind);
  });

  it.each([
    [apiError(400), "passkey-not-created"],
    [apiError(401), "passkey-not-created"],
    [apiError(429), "too-many"],
    [apiError(503), "unreachable"],
    [unreachable, "unreachable"],
  ])("creating a passkey: %s is %s", (error, kind) => {
    expect(registrationError(error)).toBe(kind);
  });

  // Anything else is a bug here, not a state of the API.
  it("rethrows an error that isn't the API's", () => {
    const bug = new TypeError("bug");
    expect(() => codeError(bug)).toThrow(bug);
    expect(() => signInError(bug)).toThrow(bug);
    expect(() => passkeyError(bug)).toThrow(bug);
  });
});

describe("signInShown", () => {
  it.each([
    ["development", true],
    ["preview", false],
    ["production", false],
  ] as const)("in %s is %s", (environment, shown) => {
    expect(signInShown(environment)).toBe(shown);
  });
});

describe("parseErrorKind", () => {
  it.each([
    "invalid-email",
    "too-many-codes",
    "wrong-code",
    "too-many",
    "unreachable",
    "too-soon",
    "start-again",
    "passkey-failed",
    "passkey-not-created",
    "code-not-sent",
  ])("reads %s from the page's address", (kind) => {
    expect(parseErrorKind(kind)).toBe(kind);
  });

  it.each([undefined, "", "other", 401, ["wrong-code"]])("reads %o as none", (value) => {
    expect(parseErrorKind(value)).toBeUndefined();
  });
});

// Where a visitor goes after signing in: back to the page they asked for, but
// only a page of this site, so a link can't send them elsewhere.
describe("parseNext", () => {
  it.each(["/es/recipes", "/en/recipes/7c0c1f9e-2d0a-4e5b-9f1a-0b2c3d4e5f60/edit", "/en"])(
    "keeps %s",
    (next) => {
      expect(parseNext(next)).toBe(next);
    },
  );

  it.each([
    undefined,
    "",
    "recipes",
    "//evil.test/es/recipes",
    "https://evil.test/es/recipes",
    "/fr/recipes",
    "/es//evil.test",
    "/es\\evil.test",
    "/es/recipes\n",
    "/en/a\u0000b",
    "/en/a\u007fb",
    42,
  ])("drops %o", (next) => {
    expect(parseNext(next)).toBeUndefined();
  });
});

describe("afterSignIn", () => {
  it.each([
    ["code", undefined, "/es/sign-in?step=passkey"],
    ["passkey", undefined, "/es/sign-in"],
    ["code", "/es/recipes", "/es/recipes"],
    ["passkey", "/es/recipes", "/es/recipes"],
  ] as const)("after a %s sign-in with next %s, goes to %s", (by, next, destination) => {
    expect(afterSignIn("es", next, by)).toBe(destination);
  });
});
