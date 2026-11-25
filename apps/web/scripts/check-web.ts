// Checks a running web app from outside: each language's health page,
// /en/health and /es/health, must answer the rendered page with the API's
// health, which proves the web app reached its API; each language's home,
// /en and /es, must answer 200, whatever it shows; and / must redirect to one
// of them. It reads the rendered markup only, never the data Start embeds in
// the page for the browser, which holds the same values whether or not they
// were rendered. scripts/smoke.ts runs this file with Node directly, which
// strips the types: its imports carry `.ts` and it uses only erasable syntax.

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const LANGUAGES = ["en", "es"];

// Where the pages must tell search engines not to index them. Keep it in step
// with INDEXING in wrangler.jsonc: "blocked" there means listed here.
const NOINDEX_ENVIRONMENTS = ["preview", "production"];

// Returns what is wrong, one line per problem; an empty list means it passed.
// `environment` is the one the API behind the web must name.
export async function checkWeb(
  baseUrl: string,
  fetchFn: Fetch,
  environment: string,
): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const failures: string[] = [];

  // A page that must answer 200 with its language and, where indexing is
  // blocked, noindex. Its HTML, or undefined when it didn't answer 200.
  async function readPage(path: string, lang: string): Promise<string | undefined> {
    const response = await fetchFn(`${base}${path}`, { redirect: "manual" });
    const html = await response.text();
    if (response.status !== 200) {
      failures.push(`${path} answered ${response.status}; expected 200`);
      return undefined;
    }
    if (!html.includes(`<html lang="${lang}"`)) {
      failures.push(`${path} has no <html lang="${lang}">`);
    }
    if (
      NOINDEX_ENVIRONMENTS.includes(environment) &&
      !(response.headers.get("x-robots-tag") ?? "").includes("noindex")
    ) {
      failures.push(`${path} has no X-Robots-Tag: noindex`);
    }
    return html;
  }

  for (const lang of LANGUAGES) {
    // The home: the health in development and preview, the building page in
    // production. Only that it answers is checked here.
    await readPage(`/${lang}`, lang);

    const path = `/${lang}/health`;
    const html = await readPage(path, lang);
    if (html === undefined) continue;
    const values = [...html.matchAll(/<dd>([^<]*)<\/dd>/g)].map((match) => match[1]);
    if (values[0] !== "ok") {
      const alert = /<p role="alert">([^<]*)<\/p>/.exec(html)?.[1];
      failures.push(
        `${path} doesn't show the status ok; it says ${JSON.stringify(alert ?? values)}`,
      );
    } else if (values[1] !== environment) {
      failures.push(
        `${path} shows the environment ${JSON.stringify(values[1])}; ` +
          `expected ${JSON.stringify(environment)}`,
      );
    }
  }

  const root = await fetchFn(`${base}/`, { redirect: "manual" });
  const location = root.headers.get("location") ?? "";
  if (root.status !== 302 || !/\/(en|es)$/.test(location)) {
    failures.push(
      `/ answered ${root.status}${location ? ` to ${location}` : ""}; expected 302 to /en or /es`,
    );
  }

  return failures;
}
