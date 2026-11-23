import { describe, expect, it } from "vitest";
import { checkWeb } from "../scripts/check-web.ts";

const BASE = "https://web.example.test";

// The page's body as the server renders it.
function page(lang: string, body: string) {
  return `<!DOCTYPE html><html lang="${lang}"><head><title>t</title></head><body><main>${body}</main></body></html>`;
}
const answer = (environment: string) =>
  `<h1>API status</h1><dl><dt>Status</dt><dd>ok</dd><dt>Environment</dt><dd>${environment}</dd></dl>`;
const unreachable = '<h1>API status</h1><p role="alert">The API cannot be reached right now.</p>';

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
  });
}
const noindex = { "X-Robots-Tag": "noindex" };
const redirect = () =>
  new Response(null, { status: 302, headers: { Location: "/en", ...noindex } });

type Pages = { en: () => Response; es: () => Response; root: () => Response };

// Answers /en, /es and / with the given pages, and anything else with 404.
function fakeFetch(pages: Pages) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/en") return pages.en();
    if (path === "/es") return pages.es();
    if (path === "/") return pages.root();
    return new Response("Not Found", { status: 404 });
  };
}

const rightPages = (environment: string, headers: Record<string, string> = noindex): Pages => ({
  en: () => html(page("en", answer(environment)), headers),
  es: () => html(page("es", answer(environment)), headers),
  root: redirect,
});

describe("checkWeb", () => {
  it("finds nothing wrong when both pages and / answer as specified", async () => {
    expect(await checkWeb(BASE, fakeFetch(rightPages("preview")), "preview")).toEqual([]);
  });

  it("reports the API not reachable, quoting what the page says", async () => {
    const pages = {
      ...rightPages("preview"),
      en: () => html(page("en", unreachable), noindex),
      es: () => html(page("es", unreachable), noindex),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en .*The API cannot be reached right now\./),
      expect.stringMatching(/^\/es .*The API cannot be reached right now\./),
    ]);
  });

  it("reports the wrong environment's name", async () => {
    const failures = await checkWeb(BASE, fakeFetch(rightPages("production")), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en .*"production".*"preview"/),
      expect.stringMatching(/^\/es .*"production".*"preview"/),
    ]);
  });

  it("reports a page without its lang", async () => {
    const pages = {
      ...rightPages("preview"),
      es: () => html(page("en", answer("preview")), noindex),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([expect.stringMatching(/^\/es .*lang="es"/)]);
  });

  it("reports / not redirecting", async () => {
    const pages = { ...rightPages("preview"), root: () => html(page("en", answer("preview"))) };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([expect.stringMatching(/^\/ answered 200/)]);
  });

  // A permanent redirect would be cached by browsers, so a visitor who
  // changes their language would keep landing on the old one.
  it("reports / redirecting with another status than 302", async () => {
    const pages = {
      ...rightPages("preview"),
      root: () => new Response(null, { status: 301, headers: { Location: "/en", ...noindex } }),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([expect.stringMatching(/^\/ answered 301 to \/en; expected 302/)]);
  });

  it("reports a page that search engines may index on preview", async () => {
    const failures = await checkWeb(BASE, fakeFetch(rightPages("preview", {})), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en .*X-Robots-Tag: noindex/),
      expect.stringMatching(/^\/es .*X-Robots-Tag: noindex/),
    ]);
  });

  it("doesn't ask for noindex locally", async () => {
    const pages = rightPages("development", {});
    expect(await checkWeb(BASE, fakeFetch(pages), "development")).toEqual([]);
  });
});
