// Usage: pnpm -C prototypes/instagram recipe <absolute path to the sample>
// Reads each post through the embed view, downloads its video, extracts the
// audio and the frames, and prints only their sizes and counts. Nothing it
// reads is printed or kept: the media live in a temporary folder that is
// removed after each post.

import { isAbsolute, join } from "node:path";
import { parsePostLink } from "./links.ts";
import {
  download,
  durationSeconds,
  extractAudio,
  extractFrames,
  sizeOf,
  withTempDir,
} from "./media-files.ts";
import { readPost } from "./post.ts";
import { readSample } from "./sample.ts";
import type { Post } from "./types.ts";

/** Between any two requests to Instagram, the page and the video alike. */
const PAUSE_MS = 5000;

const USAGE = "Usage: pnpm -C prototypes/instagram recipe <absolute path to the sample>";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [samplePath, ...extra] = process.argv.slice(2);
if (!samplePath || !isAbsolute(samplePath) || extra.length > 0) fail(USAGE);

let posts: Post[];
try {
  posts = await readSample(samplePath);
} catch (error) {
  fail(`Could not read the sample: ${error instanceof Error ? error.message : String(error)}`);
}

let first = true;
async function pause(): Promise<void> {
  if (!first) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  first = false;
}

function label(post: Post): string {
  return `post ${String(post.number).padStart(2, "0")}  ${(post.place ?? "-").padEnd(8)}`;
}

console.log(`Date: ${new Date().toISOString()}`);
console.log(`Sample: ${posts.length} posts\n`);

for (const post of posts) {
  const link = parsePostLink(post.url);
  if (!link) fail(`post ${post.number}: not a post link`);
  await pause();
  const read = await readPost(link);
  if (!read.ok) {
    console.log(`${label(post)}  not read: ${read.outcome}`);
    continue;
  }
  const { content } = read;
  const parts = [`caption ${content.caption.length} chars`, `images ${content.images.length}`];
  const video = content.video;
  if (video) {
    await pause();
    await withTempDir(async (dir) => {
      const path = join(dir, "video.mp4");
      const bytes = await download(video, path);
      const audio = await extractAudio(path, dir);
      const frames = await extractFrames(path, dir);
      parts.push(
        `video ${(bytes / 1e6).toFixed(1)} MB`,
        `${Math.round(await durationSeconds(path))} s`,
        `audio ${((await sizeOf(audio)) / 1e6).toFixed(1)} MB`,
        `frames ${frames.length}`,
      );
    });
  } else {
    parts.push("no video address");
  }
  console.log(`${label(post)}  ${parts.join("  ")}`);
}
