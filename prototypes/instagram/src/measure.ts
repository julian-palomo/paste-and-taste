// Usage: pnpm -C prototypes/instagram measure <absolute path to the sample>
//          [--via <Worker address>] [--routes embed,oembed,page] [--out <absolute folder outside the repo>]
// Reads each post once per chosen route (all three by default), one request at
// a time, and prints a line per post and route, then the totals. With --via,
// the scratch Worker makes each request from Cloudflare's network; RUN_TOKEN
// must hold the Worker's token. With --out, the output also goes to
// measure-<date>/output.txt there.

import { appendFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { USER_AGENT } from "./http.ts";
import { canonicalUrl, parsePostLink } from "./links.ts";
import { insideRepo } from "./paths.ts";
import { formatLine, formatTotals, type Result } from "./report.ts";
import { measureRoute } from "./routes/index.ts";
import { readSample } from "./sample.ts";
import { type Measurement, type Post, ROUTES, type RouteName } from "./types.ts";

/** Between any two requests, whichever route they belong to. */
const PAUSE_MS = 5000;

/** A route stops for the rest of the run after this many of these in a row. */
const STOP_AFTER = 3;
const STOPPING = new Set(["rate-limited", "login-redirect"]);

const USAGE =
  "Usage: pnpm -C prototypes/instagram measure <absolute path to the sample> [--via <Worker address>] [--routes embed,oembed,page] [--out <absolute folder outside the repo>]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    via: { type: "string" },
    routes: { type: "string", default: ROUTES.join(",") },
    out: { type: "string" },
  },
});
const [samplePath, ...extra] = positionals;
if (!samplePath || !isAbsolute(samplePath) || extra.length > 0) fail(USAGE);
const via = values.via;
const asked = values.routes.split(",");
const unknown = asked.filter((route) => !ROUTES.some((known) => known === route));
if (unknown.length > 0)
  fail(`Unknown route: ${unknown.join(", ")}; the routes are ${ROUTES.join(", ")}`);
/** The chosen routes, in their usual order. */
const routes = ROUTES.filter((route) => asked.includes(route));
const out = values.out;
if (out !== undefined && (!isAbsolute(out) || insideRepo(out))) {
  fail("--out must be an absolute folder outside the repo");
}
const token = process.env.RUN_TOKEN;
if (via && !token) fail("--via needs RUN_TOKEN set to the Worker's token");

async function measureVia(address: string, route: RouteName, post: Post): Promise<Measurement> {
  const link = parsePostLink(post.url);
  if (!link) throw new Error(`post ${post.number}: not a post link`);
  const response = await fetch(new URL("/measure", address), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ route, url: canonicalUrl(link) }),
  });
  if (!response.ok)
    fail(`The Worker answered ${response.status} for post ${post.number}; run stopped`);
  return (await response.json()) as Measurement;
}

function measureHere(route: RouteName, post: Post): Promise<Measurement> {
  const link = parsePostLink(post.url);
  if (!link) throw new Error(`post ${post.number}: not a post link`);
  return measureRoute(route, link);
}

function stopped(route: RouteName): Measurement {
  return {
    route,
    status: null,
    outcome: "stopped",
    caption: false,
    video: false,
    images: null,
    ms: 0,
  };
}

let posts: Post[];
try {
  posts = await readSample(samplePath);
} catch (error) {
  fail(`Could not read the sample: ${error instanceof Error ? error.message : String(error)}`);
}

const outputFile =
  out === undefined
    ? null
    : join(out, `measure-${new Date().toISOString().replace(/[:.]/g, "-")}`, "output.txt");
if (outputFile) mkdirSync(join(outputFile, ".."), { recursive: true });

/** Prints a line, and appends it to output.txt with --out; it holds no content from a post. */
function print(line: string): void {
  console.log(line);
  if (outputFile) appendFileSync(outputFile, `${line}\n`);
}

print(`Date: ${new Date().toISOString()}`);
print(`Place: ${via ? "Cloudflare's network, through the scratch Worker" : "this machine"}`);
print(`Sample: ${posts.length} posts; routes: ${routes.join(", ")}`);
print(`User-Agent: ${USER_AGENT}`);
print(`Pause: ${PAUSE_MS / 1000} s between requests, one at a time\n`);

const results: Result[] = [];
const inARow = new Map<RouteName, number>();
const stoppedRoutes = new Set<RouteName>();
let first = true;

for (const post of posts) {
  for (const route of routes) {
    let measurement: Measurement;
    if (stoppedRoutes.has(route)) {
      measurement = stopped(route);
    } else {
      if (!first) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      first = false;
      measurement = via ? await measureVia(via, route, post) : await measureHere(route, post);

      const count = STOPPING.has(measurement.outcome) ? (inARow.get(route) ?? 0) + 1 : 0;
      inARow.set(route, count);
      if (count === STOP_AFTER) {
        stoppedRoutes.add(route);
        print(`route ${route} stopped: ${STOP_AFTER} rate limits or login redirects in a row`);
      }
    }
    const result = { post, measurement };
    results.push(result);
    print(formatLine(result));
  }
}

print(`\n${formatTotals(results, routes)}`);
