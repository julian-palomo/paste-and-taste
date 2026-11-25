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
// Production's home: no health on it.
const building = "<h1>We're building Paste &amp; Taste</h1><p>It isn't open yet.</p>";

function html(body: string, headers: Record<string, string> = {}, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
  });
}
const noindex = { "X-Robots-Tag": "noindex" };
const redirect = () =>
  new Response(null, { status: 302, headers: { Location: "/en", ...noindex } });

type Pages = {
  en: () => Response;
  es: () => Response;
  enHealth: () => Response;
  esHealth: () => Response;
  root: () => Response;
};

// Answers each language's home and health page, and /, and anything else with 404.
function fakeFetch(pages: Pages) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/en") return pages.en();
    if (path === "/es") return pages.es();
    if (path === "/en/health") return pages.enHealth();
    if (path === "/es/health") return pages.esHealth();
    if (path === "/") return pages.root();
    return new Response("Not Found", { status: 404 });
  };
}

// Every page right: the health page shows the API's answer, and the home
// shows `home`, the health in development and preview, the building page in
// production.
const rightPages = (
  environment: string,
  headers: Record<string, string> = noindex,
  home = answer(environment),
): Pages => ({
  en: () => html(page("en", home), headers),
  es: () => html(page("es", home), headers),
  enHealth: () => html(page("en", answer(environment)), headers),
  esHealth: () => html(page("es", answer(environment)), headers),
  root: redirect,
});

describe("checkWeb", () => {
  it("finds nothing wrong when every page and / answer as specified", async () => {
    expect(await checkWeb(BASE, fakeFetch(rightPages("preview")), "preview")).toEqual([]);
  });

  it("finds nothing wrong when the home is the building page", async () => {
    const pages = rightPages("production", noindex, building);
    expect(await checkWeb(BASE, fakeFetch(pages), "production")).toEqual([]);
  });

  it("reads the health from the health page, not the home", async () => {
    const pages = { ...rightPages("preview"), en: () => html(page("en", building), noindex) };
    expect(await checkWeb(BASE, fakeFetch(pages), "preview")).toEqual([]);
  });

  it("reports the API not reachable, quoting what the health page says", async () => {
    const pages = {
      ...rightPages("preview"),
      enHealth: () => html(page("en", unreachable), noindex),
      esHealth: () => html(page("es", unreachable), noindex),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en\/health .*The API cannot be reached right now\./),
      expect.stringMatching(/^\/es\/health .*The API cannot be reached right now\./),
    ]);
  });

  it("reports the wrong environment's name", async () => {
    const pages = rightPages("production");
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en\/health .*"production".*"preview"/),
      expect.stringMatching(/^\/es\/health .*"production".*"preview"/),
    ]);
  });

  it("reports a health page that isn't there", async () => {
    const pages = {
      ...rightPages("preview"),
      esHealth: () => html(page("es", "<h1>Not found</h1>"), noindex, 404),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([expect.stringMatching(/^\/es\/health answered 404; expected 200/)]);
  });

  it("reports a health page without its lang", async () => {
    const pages = {
      ...rightPages("preview"),
      esHealth: () => html(page("en", answer("preview")), noindex),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "preview");
    expect(failures).toEqual([expect.stringMatching(/^\/es\/health .*lang="es"/)]);
  });

  it("reports a home that doesn't answer 200", async () => {
    const pages = {
      ...rightPages("production", noindex, building),
      en: () => html("", noindex, 500),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "production");
    expect(failures).toEqual([expect.stringMatching(/^\/en answered 500; expected 200/)]);
  });

  it("reports a home without its lang", async () => {
    const pages = {
      ...rightPages("production", noindex, building),
      es: () => html(page("en", building), noindex),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "production");
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

  it("reports pages that search engines may index on preview, the homes included", async () => {
    const failures = await checkWeb(BASE, fakeFetch(rightPages("preview", {})), "preview");
    expect(failures).toEqual([
      expect.stringMatching(/^\/en .*X-Robots-Tag: noindex/),
      expect.stringMatching(/^\/en\/health .*X-Robots-Tag: noindex/),
      expect.stringMatching(/^\/es .*X-Robots-Tag: noindex/),
      expect.stringMatching(/^\/es\/health .*X-Robots-Tag: noindex/),
    ]);
  });

  it("reports a home that search engines may index in production", async () => {
    const pages = {
      ...rightPages("production", noindex, building),
      en: () => html(page("en", building), {}),
    };
    const failures = await checkWeb(BASE, fakeFetch(pages), "production");
    expect(failures).toEqual([expect.stringMatching(/^\/en .*X-Robots-Tag: noindex/)]);
  });

  it("doesn't ask for noindex locally", async () => {
    const pages = rightPages("development", {});
    expect(await checkWeb(BASE, fakeFetch(pages), "development")).toEqual([]);
  });
});
