import { describe, expect, it } from "vitest";
import { pageHead } from "../src/head.ts";
import { messagesFor } from "../src/i18n/i18n.ts";

describe.each(["en", "es"] as const)("pageHead in %s", (lang) => {
  const head = pageHead(lang, "https://web.test");

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
