import { describe, expect, it } from "vitest";
import { messagesFor, parseLanguage, pickLanguage } from "../src/i18n/i18n.ts";

// Round 14 removed them: the error after asking too soon already says when,
// and a code field needs no "the 6 digits" under it.
it.each(["en", "es"] as const)("in %s, the removed sign-in hints are gone", (lang) => {
  const messages: Record<string, string> = messagesFor(lang);

  expect(messages).not.toHaveProperty("signInResendHint");
  expect(messages).not.toHaveProperty("signInCodeHint");
});

describe("parseLanguage", () => {
  it("accepts the two languages of the interface", () => {
    expect(parseLanguage("en")).toBe("en");
    expect(parseLanguage("es")).toBe("es");
  });

  it("rejects anything else", () => {
    expect(parseLanguage("fr")).toBeUndefined();
    expect(parseLanguage("EN")).toBeUndefined();
    expect(parseLanguage("")).toBeUndefined();
  });
});

describe("pickLanguage", () => {
  it("picks Spanish when the browser prefers it", () => {
    expect(pickLanguage("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
  });

  it("picks English when the browser prefers it", () => {
    expect(pickLanguage("en-GB,en;q=0.9")).toBe("en");
  });

  it("follows the weights, not the order", () => {
    expect(pickLanguage("en;q=0.5,es;q=0.9")).toBe("es");
  });

  it("skips languages it doesn't have", () => {
    expect(pickLanguage("fr-FR,fr;q=0.9,es;q=0.5")).toBe("es");
  });

  it("falls back to English when neither language is asked for", () => {
    expect(pickLanguage("fr")).toBe("en");
    expect(pickLanguage("")).toBe("en");
    expect(pickLanguage(null)).toBe("en");
  });
});

describe("messagesFor", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(messagesFor("es")).sort()).toEqual(Object.keys(messagesFor("en")).sort());
  });

  it("gives each language its own text", () => {
    expect(messagesFor("es").heading).not.toBe(messagesFor("en").heading);
  });
});
