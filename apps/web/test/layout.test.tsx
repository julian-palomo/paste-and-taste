import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { messagesFor } from "../src/i18n/i18n.ts";
import { Layout } from "../src/layout/layout.tsx";

// Text as renderToString writes it: "Paste & Taste" becomes "Paste &amp; Taste".
const escaped = (text: string) => text.replaceAll("&", "&amp;");

describe("Layout", () => {
  it("links a page under /en to the same page in Spanish", () => {
    const html = renderToString(
      <Layout lang="en" path="/en/recipes/42">
        <h1>Page</h1>
      </Layout>,
    );

    // /i: React writes the JSX spelling, hrefLang; HTML attribute names ignore case.
    expect(html).toMatch(/href="\/es\/recipes\/42" hreflang="es" lang="es"/i);
    expect(html).toContain(`>${messagesFor("en").otherLanguage}</a>`);
  });

  it("links a page under /es to the same page in English", () => {
    const html = renderToString(
      <Layout lang="es" path="/es/recipes/42">
        <h1>Página</h1>
      </Layout>,
    );

    expect(html).toMatch(/href="\/en\/recipes\/42" hreflang="en" lang="en"/i);
    expect(html).toContain(`>${messagesFor("es").otherLanguage}</a>`);
  });

  it.each(["en", "es"] as const)(
    "in %s, has the landmarks, the app's name home and the page",
    (lang) => {
      const messages = messagesFor(lang);
      const html = renderToString(
        <Layout lang={lang} path={`/${lang}`}>
          <h1>The page</h1>
        </Layout>,
      );

      expect(html).toMatch(
        new RegExp(`<header[^>]*>.*href="/${lang}"[^>]*>${escaped(messages.appName)}</a>`),
      );
      expect(html).toMatch(/<main[^>]*><h1>The page<\/h1><\/main>/);
      expect(html).toMatch(new RegExp(`<footer[^>]*>.*${escaped(messages.footer)}`));
    },
  );
});
