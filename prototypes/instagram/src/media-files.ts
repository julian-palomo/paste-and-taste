// Downloads a post's media into a temporary folder and extracts what the
// candidates read: the audio, and frames. The folder is removed when the work
// with it ends, whether it succeeded or not: no media outlives a run.

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { USER_AGENT } from "./http.ts";

const run = promisify(execFile);

/** A frame every this many seconds, up to MAX_FRAMES, this many pixels wide. */
const FRAME_EVERY_S = 4;
const MAX_FRAMES = 30;
const FRAME_WIDTH = 768;

export async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "instagram-spike-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Downloads `url` to `path` and returns its size in bytes. */
export async function download(url: string, path: string): Promise<number> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`download answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(path, bytes);
  return bytes.length;
}

export async function durationSeconds(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  return Number(stdout.trim());
}

/** The audio as 16 kHz mono WAV, the rate speech models expect. */
export async function extractAudio(video: string, dir: string): Promise<string> {
  const path = join(dir, "audio.wav");
  await run("ffmpeg", ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", path]);
  return path;
}

/** Returns the frames' paths in order. */
export async function extractFrames(video: string, dir: string): Promise<string[]> {
  const framesDir = join(dir, "frames");
  await mkdir(framesDir);
  await run("ffmpeg", [
    "-v",
    "error",
    "-i",
    video,
    "-vf",
    `fps=1/${FRAME_EVERY_S},scale=${FRAME_WIDTH}:-2`,
    "-frames:v",
    String(MAX_FRAMES),
    join(framesDir, "frame-%02d.jpg"),
  ]);
  const names = (await readdir(framesDir)).sort();
  return names.map((name) => join(framesDir, name));
}
