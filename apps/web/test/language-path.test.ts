import { describe, expect, it } from "vitest";
import { languageOfPath, pathInLanguage } from "../src/layout/language-path.ts";

describe("pathInLanguage", () => {
  it("takes a path under /en to the same path under /es", () => {
    expect(pathInLanguage("/en/recipes/42", "es")).toBe("/es/recipes/42");
  });

  it("takes a path under /es to the same path under /en", () => {
    expect(pathInLanguage("/es/recipes/42", "en")).toBe("/en/recipes/42");
  });

  it("takes a language's home to the other's", () => {
    expect(pathInLanguage("/en", "es")).toBe("/es");
    expect(pathInLanguage("/es/", "en")).toBe("/en/");
  });

  it("takes a path under no language to the language's home", () => {
    expect(pathInLanguage("/nothing", "es")).toBe("/es");
    expect(pathInLanguage("/", "en")).toBe("/en");
  });
});

describe("languageOfPath", () => {
  it("reads the language a path starts with", () => {
    expect(languageOfPath("/en/recipes/42")).toBe("en");
    expect(languageOfPath("/es")).toBe("es");
  });

  it("falls back to English for any other path", () => {
    expect(languageOfPath("/fr/recipes")).toBe("en");
    expect(languageOfPath("/nothing")).toBe("en");
    expect(languageOfPath("/english")).toBe("en");
    expect(languageOfPath("/")).toBe("en");
  });
});
