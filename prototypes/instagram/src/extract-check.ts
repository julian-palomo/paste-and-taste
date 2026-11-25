// Usage: pnpm -C prototypes/instagram extract-check <absolute path to the sample>
//          --out <absolute folder outside the repo> [--budget 5]
//          [--post <number> --media-worker <scratch Worker address>]
// For each post with a video address: the embed view, a HEAD and a 1 KB range
// request on the video address, and the download, one request at a time with
// a pause between; then Whisper on Workers AI with the MP4 as it is, with no
// audio extracted. It prints statuses, whether headers came, sizes, times and
// costs, never the transcript. The video lives in a temporary folder removed
// after each post; Whisper's cost goes to --out/ledger.json, within --budget.
// With --post and --media-worker it only reads that post and downloads its
// video, then POSTs it to the scratch Worker that tries Media Transformations'
// binding; RUN_TOKEN must hold the Worker's token.

import { appendFileSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { type Transcript, transcribe, transcribeEstimateUsd } from "./candidates/speech.ts";
import { USER_AGENT } from "./http.ts";
import { Ledger } from "./ledger.ts";
import { parsePostLink } from "./links.ts";
import { download, durationSeconds, withTempDir } from "./media-files.ts";
import { insideRepo } from "./paths.ts";
import { readPost } from "./post.ts";
import { WHISPER } from "./prices.ts";
import { readSample } from "./sample.ts";
import type { Post } from "./types.ts";

/** Between any two requests to Instagram. */
const PAUSE_MS = 5000;

const USAGE =
  "Usage: pnpm -C prototypes/instagram extract-check <absolute path to the sample> --out <absolute folder outside the repo> [--budget 5] [--post <number> --media-worker <address>]";

/** The scratch Worker asks for at most this much audio: the documented default stops at 60 s. */
const MAX_MEDIA_SECONDS = 60;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    budget: { type: "string", default: "5" },
    post: { type: "string" },
    "media-worker": { type: "string" },
  },
});
const [samplePath, ...extra] = positionals;
if (!samplePath || !isAbsolute(samplePath) || extra.length > 0) fail(USAGE);
if (!values.out || !isAbsolute(values.out) || insideRepo(values.out)) fail(USAGE);
const budget = Number(values.budget);
if (!(budget > 0)) fail("--budget must be a positive number of USD");
const mediaWorker = values["media-worker"];
const onePost = values.post === undefined ? null : Number(values.post);
if ((mediaWorker === undefined) !== (onePost === null)) {
  fail("--post and --media-worker go together");
}
if (onePost !== null && !(Number.isInteger(onePost) && onePost > 0))
  fail("--post must be a line number");
const token = process.env.RUN_TOKEN;
if (mediaWorker !== undefined && !token)
  fail("--media-worker needs RUN_TOKEN set to the Worker's token");

let posts: Post[];
try {
  posts = await readSample(samplePath);
} catch (error) {
  fail(`Could not read the sample: ${error instanceof Error ? error.message : String(error)}`);
}

const ledger = await Ledger.open(join(values.out, "ledger.json"), budget);
const runDir = join(values.out, `extract-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(runDir, { recursive: true });

/** Prints a line and appends it to the run's output.txt, which holds no content from a post. */
function print(line: string): void {
  console.log(line);
  appendFileSync(join(runDir, "output.txt"), `${line}\n`);
}

let first = true;
async function pause(): Promise<void> {
  if (!first) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  first = false;
}

type Probe = { status: number | null; header: boolean };

/** One request; whether `header` came back. A network error is status null. */
async function probe(address: string, init: RequestInit, header: string): Promise<Probe> {
  try {
    const response = await fetch(address, {
      ...init,
      headers: { "user-agent": USER_AGENT, ...(init.headers as Record<string, string>) },
    });
    await response.body?.cancel();
    return { status: response.status, header: response.headers.has(header) };
  } catch {
    return { status: null, header: false };
  }
}

type Row = {
  post: number;
  head: Probe;
  range: Probe;
  megabytes: number;
  seconds: number;
  whisper: Transcript | null;
};

/** Sends one post's video to the scratch Worker and prints what the binding gave back. */
async function tryMediaWorker(address: string, number: number): Promise<void> {
  const post = posts.find((candidate) => candidate.number === number);
  const link = post ? parsePostLink(post.url) : null;
  if (!link) fail(`post ${number} is not in the sample`);
  const read = await readPost(link);
  if (!read.ok || !read.content.video) fail(`post ${number} gave no video address`);
  const video = read.content.video;
  await pause();
  await withTempDir(async (dir) => {
    const path = join(dir, "video.mp4");
    await download(video, path);
    const seconds = await durationSeconds(path);
    if (seconds > MAX_MEDIA_SECONDS) {
      fail(
        `post ${number} is ${Math.round(seconds)} s; pick one of ${MAX_MEDIA_SECONDS} s or less`,
      );
    }
    const started = Date.now();
    const response = await fetch(new URL("/extract", address), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "video/mp4",
        "x-video-seconds": String(seconds),
      },
      body: await readFile(path),
    });
    const ms = Date.now() - started;
    print(`post ${String(number).padStart(2, "0")}  ${Math.round(seconds)} s`);
    print(`Worker answered ${response.status} in ${(ms / 1000).toFixed(1)} s`);
    // The answer holds types, sizes, times and errors, never media.
    print(await response.text());
  });
}

if (mediaWorker !== undefined && onePost !== null) {
  print(`Date: ${new Date().toISOString()}`);
  print("Place: this machine, through the scratch Worker on Cloudflare's network");
  await tryMediaWorker(mediaWorker, onePost);
  process.exit(0);
}

const rows: Row[] = [];
const spentBefore = ledger.totalUsd;

print(`Date: ${new Date().toISOString()}`);
print("Place: this machine");
print(`Sample: ${posts.length} posts`);
print(`User-Agent: ${USER_AGENT}`);
print(`Budget: ${budget} USD, ${ledger.totalUsd.toFixed(4)} USD already spent\n`);

for (const post of posts) {
  const link = parsePostLink(post.url);
  if (!link) fail(`post ${post.number}: not a post link`);
  const label = `post ${String(post.number).padStart(2, "0")}`;

  await pause();
  const read = await readPost(link);
  if (!read.ok) {
    print(`${label}  not read: ${read.outcome}`);
    continue;
  }
  const video = read.content.video;
  if (!video) {
    print(`${label}  no video address`);
    continue;
  }

  await pause();
  const head = await probe(video, { method: "HEAD" }, "accept-ranges");
  await pause();
  const range = await probe(video, { headers: { range: "bytes=0-1023" } }, "content-range");
  await pause();

  const row = await withTempDir(async (dir): Promise<Row | null> => {
    const path = join(dir, "video.mp4");
    const bytes = await download(video, path);
    const seconds = await durationSeconds(path);
    const estimate = transcribeEstimateUsd(seconds);
    if (!ledger.allows(estimate)) {
      print(
        `Budget: stopping before ${label}'s Whisper call, whose worst case is ${estimate.toFixed(4)} USD`,
      );
      return null;
    }
    const whisper = await transcribe(path);
    if (whisper.costUsd > 0) {
      await ledger.add({
        post: post.number,
        step: "whisper on mp4",
        model: WHISPER.model,
        costUsd: whisper.costUsd,
      });
    }
    return { post: post.number, head, range, megabytes: bytes / 1e6, seconds, whisper };
  });
  if (!row) break;
  rows.push(row);

  const whisper = row.whisper;
  print(
    [
      label,
      `HEAD ${head.status ?? "error"} accept-ranges ${head.header ? "yes" : "no"}`,
      `range ${range.status ?? "error"} content-range ${range.header ? "yes" : "no"}`,
      `${row.megabytes.toFixed(1)} MB ${Math.round(row.seconds)} s`,
      whisper?.error
        ? `whisper ${whisper.error}`
        : `whisper ok, ${whisper?.text.length ?? 0} chars, reported ${whisper?.seconds === null ? "-" : `${Math.round(whisper?.seconds ?? 0)} s`}`,
      `${((whisper?.ms ?? 0) / 1000).toFixed(1)} s`,
      `${(whisper?.costUsd ?? 0).toFixed(4)} USD`,
    ].join("  "),
  );
}

const count = (test: (row: Row) => boolean) => `${rows.filter(test).length}/${rows.length}`;
print("\n| Check | Posts |");
print("| --- | --- |");
print(`| HEAD answered 200 | ${count((r) => r.head.status === 200)} |`);
print(`| HEAD sent Accept-Ranges | ${count((r) => r.head.header)} |`);
print(`| Range request answered 206 | ${count((r) => r.range.status === 206)} |`);
print(`| Range request sent Content-Range | ${count((r) => r.range.header)} |`);
print(`| Whisper took the MP4 | ${count((r) => r.whisper !== null && r.whisper.error === null)} |`);
print(`\nSpent in this run (ledger): ${(ledger.totalUsd - spentBefore).toFixed(4)} USD`);
print(`Spent in the whole issue (ledger): ${ledger.totalUsd.toFixed(4)} USD of ${budget} USD`);
print(`Output: ${runDir}`);
