import { describe, expect, it } from "vitest";
import { pageHead } from "../src/head.ts";
import { messagesFor } from "../src/i18n/i18n.ts";

describe.each(["en", "es"] as const)("pageHead in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", "home");

  it("has the title and the description in the page's language", () => {
    expect(head.meta).toEqual([
      { title: messagesFor(lang).title },
      { name: "description", content: messagesFor(lang).description },
    ]);
  });

  it("points to each language's address, and to / as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/" },
    ]);
  });
});

describe.each(["en", "es"] as const)("pageHead for the showcase page in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", "showcase");

  it("has the showcase's title and description", () => {
    expect(head.meta).toEqual([
      { title: messagesFor(lang).showcaseTitle },
      { name: "description", content: messagesFor(lang).showcaseDescription },
    ]);
  });

  // "/" only sends a visitor to a language's home, so the default for any
  // other page is its English address, the language a visitor gets when
  // their browser asks for neither.
  it("points to the showcase in each language, and to the English one as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en/showcase" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es/showcase" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/en/showcase" },
    ]);
  });
});

describe.each(["en", "es"] as const)("pageHead for the sign-in page in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", "signIn");

  it("has the sign-in page's title and description", () => {
    expect(head.meta).toEqual([
      { title: messagesFor(lang).signInTitle },
      { name: "description", content: messagesFor(lang).signInDescription },
    ]);
  });

  it("points to the sign-in page in each language, and to the English one as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en/sign-in" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es/sign-in" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/en/sign-in" },
    ]);
  });
});

describe.each(["en", "es"] as const)("pageHead for the health page in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", "health");

  it("has the health's title and description", () => {
    expect(head.meta).toEqual([
      { title: messagesFor(lang).title },
      { name: "description", content: messagesFor(lang).description },
    ]);
  });

  it("points to the health page in each language, and to the English one as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en/health" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es/health" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/en/health" },
    ]);
  });
});

describe.each(["en", "es"] as const)("pageHead for the building page in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", "building");

  it("has the building page's title and description", () => {
    expect(head.meta).toEqual([
      { title: messagesFor(lang).buildingTitle },
      { name: "description", content: messagesFor(lang).buildingDescription },
    ]);
  });

  // It is the home, so / is the default: it sends each visitor to their language.
  it("points to each language's home, and to / as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/" },
    ]);
  });
});

// A page whose address and title depend on its data: a recipe's.
describe.each(["en", "es"] as const)("pageHead for a page of its own in %s", (lang) => {
  const head = pageHead(lang, "https://web.test", {
    path: "/recipes/abc",
    title: "Tortilla de patatas",
    description: "A recipe.",
  });

  it("has the title and the description it was given", () => {
    expect(head.meta).toEqual([
      { title: "Tortilla de patatas" },
      { name: "description", content: "A recipe." },
    ]);
  });

  it("points to the page in each language, and to the English one as the default", () => {
    expect(head.links).toEqual([
      { rel: "alternate", hrefLang: "en", href: "https://web.test/en/recipes/abc" },
      { rel: "alternate", hrefLang: "es", href: "https://web.test/es/recipes/abc" },
      { rel: "alternate", hrefLang: "x-default", href: "https://web.test/en/recipes/abc" },
    ]);
  });
});
