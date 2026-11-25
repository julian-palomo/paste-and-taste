// Usage: pnpm -C prototypes/instagram recipe <absolute path to the sample>
//          --candidates A[,B,C] --out <absolute folder outside the repo> [--budget 10]
//          [--videos <absolute folder of the owner's recordings>] [--inline-limit-mb 70]
// Reads each post through the embed view, downloads its media, and has each
// candidate write the recipe. With --videos, a post whose post-NN.mp4 is in
// that folder uses it as its video, which is never fetched from Instagram. It prints only times, tokens and costs. The
// answers, the marks sheet and its key go to a run folder under --out; the
// ledger, --out/ledger.json, counts every paid call of every run. The media
// live in a temporary folder that is removed after each post.

import { appendFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Candidate, CandidateId, PostInput } from "./candidates/candidate.ts";
import { claudeCandidate } from "./candidates/claude.ts";
import { geminiCandidate } from "./candidates/gemini.ts";
import { type Transcript, transcribe, transcribeEstimateUsd } from "./candidates/speech.ts";
import { workersAiCandidate } from "./candidates/workers-ai.ts";
import { Ledger } from "./ledger.ts";
import { parsePostLink } from "./links.ts";
import {
  download,
  durationSeconds,
  extractAudio,
  extractFrames,
  withTempDir,
} from "./media-files.ts";
import { readPost } from "./post.ts";
import { WHISPER } from "./prices.ts";
import {
  formatLine,
  formatTables,
  keyCsv,
  marksCsv,
  type Row,
  type Step,
  shuffledLetters,
} from "./recipe-report.ts";
import { readSample } from "./sample.ts";
import type { Post } from "./types.ts";

/** Between any two requests to Instagram, the page and the media alike. */
const PAUSE_MS = 5000;

const CANDIDATES: Record<CandidateId, Candidate> = {
  A: geminiCandidate,
  B: workersAiCandidate,
  C: claudeCandidate,
};

const USAGE =
  "Usage: pnpm -C prototypes/instagram recipe <absolute path to the sample> --candidates A[,B,C] --out <absolute folder outside the repo> [--budget 10] [--videos <absolute folder outside the repo>] [--inline-limit-mb 70]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    candidates: { type: "string" },
    out: { type: "string" },
    budget: { type: "string", default: "10" },
    videos: { type: "string" },
    "inline-limit-mb": { type: "string", default: "70" },
  },
});
const [samplePath, ...extra] = positionals;
if (!samplePath || !isAbsolute(samplePath) || extra.length > 0) fail(USAGE);
if (!values.out || !isAbsolute(values.out)) fail(USAGE);

// Answers and recordings are other people's content: they must never be in the repo.
const repoRoot = resolve(import.meta.dirname, "../../..");
function insideRepo(path: string): boolean {
  const fromRepo = relative(repoRoot, path);
  return !fromRepo.startsWith("..") && !isAbsolute(fromRepo);
}
if (insideRepo(values.out)) fail("--out must be outside the repo");
const videos = values.videos;
if (videos !== undefined && (!isAbsolute(videos) || insideRepo(videos))) {
  fail("--videos must be an absolute folder outside the repo");
}
const inlineLimitMb = Number(values["inline-limit-mb"]);
if (!(inlineLimitMb >= 0)) fail("--inline-limit-mb must be a number of megabytes, 0 or more");

const chosen: Candidate[] = [];
for (const id of (values.candidates ?? "").split(",")) {
  const candidate = CANDIDATES[id as CandidateId];
  if (!candidate) fail(`Unknown or unavailable candidate: ${id}`);
  chosen.push(candidate);
}
const budget = Number(values.budget);
if (!(budget > 0)) fail("--budget must be a positive number of USD");

let posts: Post[];
try {
  posts = await readSample(samplePath);
} catch (error) {
  fail(`Could not read the sample: ${error instanceof Error ? error.message : String(error)}`);
}

const ledger = await Ledger.open(join(values.out, "ledger.json"), budget);
const spentBefore = ledger.totalUsd;
const runDir = join(values.out, `run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await mkdir(join(runDir, "recipes"), { recursive: true });

/** Prints a line and appends it to the run's output.txt, which holds no content from a post. */
function print(line: string): void {
  console.log(line);
  appendFileSync(join(runDir, "output.txt"), `${line}\n`);
}

/** The owner's recording of a post, named by its line number in the sample. */
function recordingOf(post: Post): string {
  return join(videos ?? "", `post-${String(post.number).padStart(2, "0")}.mp4`);
}

let first = true;
async function pause(): Promise<void> {
  if (!first) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  first = false;
}

async function timed<T>(work: () => Promise<T>): Promise<[T, number]> {
  const started = Date.now();
  const result = await work();
  return [result, Date.now() - started];
}

print(`Date: ${new Date().toISOString()}`);
print("Place: this machine");
print(`Sample: ${posts.length} posts`);
if (videos !== undefined) {
  const found = posts.filter((post) => existsSync(recordingOf(post))).length;
  print(`Videos: the owner's recordings, ${found} of ${posts.length} posts`);
}
for (const candidate of chosen) {
  print(`Candidate ${candidate.id}: ${candidate.label} (${candidate.model})`);
}
print(`Budget: ${budget} USD, ${ledger.totalUsd.toFixed(4)} USD already spent\n`);

const rows: Row[] = [];
let stopped = false;

for (const post of posts) {
  if (stopped) break;
  const link = parsePostLink(post.url);
  if (!link) fail(`post ${post.number}: not a post link`);
  const label = `post ${String(post.number).padStart(2, "0")}`;

  await pause();
  const [read, readMs] = await timed(() => readPost(link));
  if (!read.ok) {
    print(`${label}  not read: ${read.outcome}`);
    continue;
  }
  const { content } = read;

  await withTempDir(async (dir) => {
    const input: PostInput = {
      caption: content.caption,
      video: null,
      videoSeconds: null,
      images: [],
      frames: [],
      transcript: null,
      inlineLimitBytes: inlineLimitMb * 1_000_000,
    };
    let downloadMs = 0;
    let downloaded = false;
    const video = content.video;
    const recording = videos === undefined ? null : recordingOf(post);
    if (recording && existsSync(recording)) {
      input.video = recording;
      input.videoSeconds = await durationSeconds(recording);
    } else if (video) {
      await pause();
      const path = join(dir, "video.mp4");
      [, downloadMs] = await timed(() => download(video, path));
      downloaded = true;
      input.video = path;
      input.videoSeconds = await durationSeconds(path);
    }
    for (const [index, url] of content.images.entries()) {
      await pause();
      const path = join(dir, `image-${index}.jpg`);
      const [, ms] = await timed(() => download(url, path));
      downloadMs += ms;
      downloaded = true;
      input.images.push(path);
    }

    let extractMs = 0;
    let transcript: Transcript | null = null;
    if (input.video && input.videoSeconds !== null && chosen.some((c) => c.needsExtract)) {
      const videoPath = input.video;
      const [[frames, audio], ms] = await timed(() =>
        Promise.all([extractFrames(videoPath, dir), extractAudio(videoPath, dir)]),
      );
      input.frames = frames;
      extractMs = ms;

      const estimate = transcribeEstimateUsd(input.videoSeconds);
      if (!ledger.allows(estimate)) {
        print(
          `Budget: stopping before ${label}'s transcript, whose worst case is ${estimate.toFixed(4)} USD`,
        );
        stopped = true;
        return;
      }
      transcript = await transcribe(audio);
      if (transcript.costUsd > 0) {
        await ledger.add({
          post: post.number,
          step: "transcribe",
          model: WHISPER.model,
          costUsd: transcript.costUsd,
        });
      }
      input.transcript = transcript.error ? null : transcript.text;
    }

    const letters = shuffledLetters(chosen.length);
    for (const [index, candidate] of chosen.entries()) {
      const estimate = candidate.estimateUsd(input);
      if (!ledger.allows(estimate)) {
        print(
          `Budget: stopping before ${label} ${candidate.id}, whose worst case is ${estimate.toFixed(4)} USD`,
        );
        stopped = true;
        return;
      }
      const written = await candidate.write(input);
      if (written.costUsd > 0) {
        await ledger.add({
          post: post.number,
          step: `write ${candidate.id}`,
          model: candidate.model,
          costUsd: written.costUsd,
        });
      }

      const letter = letters[index] ?? "?";
      const recipeFile = `recipes/post-${String(post.number).padStart(2, "0")}.${letter}.json`;
      const saved = written.error ? { error: written.error } : written.answer;
      await writeFile(join(runDir, recipeFile), `${JSON.stringify(saved, null, 2)}\n`);

      const steps: Row["steps"] = [{ step: "read" as Step, ms: readMs }];
      if (downloaded) steps.push({ step: "download", ms: downloadMs });
      const speech = candidate.needsExtract ? transcript : null;
      if (candidate.needsExtract && input.video) steps.push({ step: "extract", ms: extractMs });
      if (speech) steps.push({ step: "transcribe", ms: speech.ms });
      steps.push({ step: "write", ms: written.ms });

      const row: Row = {
        post: post.number,
        place: post.place,
        candidate: candidate.id,
        letter,
        valid: written.valid,
        steps,
        inputTokens: written.inputTokens,
        outputTokens: written.outputTokens,
        audioSeconds: speech?.seconds ?? null,
        // A candidate's cost is its whole chain: the shared transcript counts for each one.
        costUsd: written.costUsd + (speech?.costUsd ?? 0),
        error: written.error ?? (speech?.error ? `transcribe ${speech.error}` : null),
        recipeFile,
      };
      rows.push(row);
      print(formatLine(row));
    }
  });
}

await writeFile(join(runDir, "marks.csv"), marksCsv(rows));
await writeFile(join(runDir, "marks-key.csv"), keyCsv(rows));

if (rows.length > 0) print(`\n${formatTables(rows)}`);
print(`\nSpent in this run (ledger): ${(ledger.totalUsd - spentBefore).toFixed(4)} USD`);
print(`Spent in the whole issue (ledger): ${ledger.totalUsd.toFixed(4)} USD of ${budget} USD`);
print(`Answers and the marks sheet: ${runDir}`);
