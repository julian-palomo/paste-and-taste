// Usage: pnpm -C prototypes/instagram measure <absolute path to the sample> [--via <Worker address>]
// Reads each post once per route, one request at a time, and prints a line per
// post and route, then the totals. With --via, the scratch Worker makes each
// request from Cloudflare's network; RUN_TOKEN must hold the Worker's token.

import { isAbsolute } from "node:path";
import { USER_AGENT } from "./http.ts";
import { canonicalUrl, parsePostLink } from "./links.ts";
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
  "Usage: pnpm -C prototypes/instagram measure <absolute path to the sample> [--via <Worker address>]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [samplePath, flag, via, ...extra] = process.argv.slice(2);
if (!samplePath || !isAbsolute(samplePath) || extra.length > 0) fail(USAGE);
if (flag !== undefined && (flag !== "--via" || !via)) fail(USAGE);
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

console.log(`Date: ${new Date().toISOString()}`);
console.log(`Place: ${via ? "Cloudflare's network, through the scratch Worker" : "this machine"}`);
console.log(`Sample: ${posts.length} posts; routes: ${ROUTES.join(", ")}`);
console.log(`User-Agent: ${USER_AGENT}`);
console.log(`Pause: ${PAUSE_MS / 1000} s between requests, one at a time\n`);

const results: Result[] = [];
const inARow = new Map<RouteName, number>();
const stoppedRoutes = new Set<RouteName>();
let first = true;

for (const post of posts) {
  for (const route of ROUTES) {
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
        console.log(
          `route ${route} stopped: ${STOP_AFTER} rate limits or login redirects in a row`,
        );
      }
    }
    const result = { post, measurement };
    results.push(result);
    console.log(formatLine(result));
  }
}

console.log(`\n${formatTotals(results)}`);
