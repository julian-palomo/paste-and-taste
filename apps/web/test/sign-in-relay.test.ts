import { ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";
import { describe, expect, it } from "vitest";
import {
  clearPendingCookie,
  codeError,
  parseErrorKind,
  passkeyError,
  pendingCookie,
  readPending,
  relayHeaders,
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
  ])("reads %s from the page's address", (kind) => {
    expect(parseErrorKind(kind)).toBe(kind);
  });

  it.each([undefined, "", "other", 401, ["wrong-code"]])("reads %o as none", (value) => {
    expect(parseErrorKind(value)).toBeUndefined();
  });
});
