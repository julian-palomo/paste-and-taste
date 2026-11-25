import { describe, expect, it } from "vitest";
import { createPasskey, signInWithPasskey } from "../src/sign-in/passkey-flow.ts";

// The two ceremonies with the browser's part faked: options and answers are
// JSON text, and the WebAuthn call resolves to the credential's JSON, to
// null, or rejects (a cancelled or refused ceremony).
const options = async () => ({ ok: true as const, optionsJson: '{"challenge":"c"}' });
const ok = async () => ({ ok: true as const });
const cancelled = async () => {
  throw new DOMException("The operation was cancelled.", "NotAllowedError");
};

describe("createPasskey", () => {
  it("registers the credential the browser created", async () => {
    const seen: string[] = [];

    const result = await createPasskey({
      getOptions: options,
      create: async (optionsJson) => {
        seen.push(optionsJson);
        return '{"id":"k"}';
      },
      register: async (responseJson) => {
        seen.push(responseJson);
        return { ok: true };
      },
    });

    expect(result).toEqual({ ok: true });
    expect(seen).toEqual(['{"challenge":"c"}', '{"id":"k"}']);
  });

  it.each([
    ["is cancelled", cancelled],
    ["gives no credential", async () => null],
  ])("when the browser's ceremony %s, is passkey-not-created", async (_, create) => {
    expect(await createPasskey({ getOptions: options, create, register: ok })).toEqual({
      ok: false,
      error: "passkey-not-created",
    });
  });

  it("passes on a failure to get the options", async () => {
    const result = await createPasskey({
      getOptions: async () => ({ ok: false, error: "too-many" }),
      create: async () => '{"id":"k"}',
      register: ok,
    });

    expect(result).toEqual({ ok: false, error: "too-many" });
  });
});

describe("signInWithPasskey", () => {
  it("signs in with the credential the browser gave", async () => {
    const result = await signInWithPasskey({
      getOptions: options,
      get: async () => '{"id":"k"}',
      signIn: async (responseJson) =>
        responseJson === '{"id":"k"}' ? { ok: true } : { ok: false, error: "passkey-failed" },
    });

    expect(result).toEqual({ ok: true });
  });

  it.each([
    ["is cancelled", cancelled],
    ["gives no credential", async () => null],
  ])("when the browser's ceremony %s, is passkey-failed", async (_, get) => {
    expect(await signInWithPasskey({ getOptions: options, get, signIn: ok })).toEqual({
      ok: false,
      error: "passkey-failed",
    });
  });
});
