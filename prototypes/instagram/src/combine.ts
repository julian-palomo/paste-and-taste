// Usage: pnpm -C prototypes/instagram combine <absolute --out folder> <run folder> <run folder> ...
// Builds one blind marks sheet from several runs: for each post and candidate
// it takes the answer of the last run given that has one, copies it under a
// letter shuffled again per post, and writes marks.csv and marks-key.csv to a
// new folder under --out, which `marks` reads like a run folder.

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { readCsv } from "./csv.ts";
import { shuffledLetters } from "./recipe-report.ts";

type Answer = { post: number; place: string; candidate: string; valid: boolean; file: string };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [out, ...runs] = process.argv.slice(2);
if (!out || runs.length === 0 || ![out, ...runs].every((path) => isAbsolute(path))) {
  fail("Usage: pnpm -C prototypes/instagram combine <absolute --out folder> <run folder> ...");
}

const chosen = new Map<string, Answer>();
for (const run of runs) {
  const key = new Map<string, string>();
  for (const [post, letter, candidate] of await readCsv(join(run, "marks-key.csv"))) {
    key.set(`${post}.${letter}`, candidate ?? "?");
  }
  for (const [post, place, letter, valid, file] of await readCsv(join(run, "marks.csv"))) {
    const candidate = key.get(`${post}.${letter}`);
    if (!candidate || !file) fail(`${run}: post ${post}, letter ${letter} is not in the key`);
    // A later run replaces an earlier one's answer for the same post and candidate.
    chosen.set(`${post}.${candidate}`, {
      post: Number(post),
      place: place ?? "",
      candidate,
      valid: valid === "true",
      file: join(run, file),
    });
  }
}

const folder = join(out, `combined-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await mkdir(join(folder, "recipes"), { recursive: true });

const marks = ["post,place,letter,valid,recipe_file,mark,note"];
const keyLines = ["post,letter,candidate"];
const posts = [...new Set([...chosen.values()].map((answer) => answer.post))].sort((a, b) => a - b);
for (const post of posts) {
  const answers = [...chosen.values()].filter((answer) => answer.post === post);
  const letters = shuffledLetters(answers.length);
  const lettered = answers.map((answer, index) => ({ ...answer, letter: letters[index] ?? "?" }));
  for (const answer of lettered.sort((a, b) => a.letter.localeCompare(b.letter))) {
    const file = `recipes/post-${String(post).padStart(2, "0")}.${answer.letter}.json`;
    await copyFile(answer.file, join(folder, file));
    const mark = answer.valid ? "" : "wrong";
    const note = answer.valid ? "" : "invalid";
    marks.push([post, answer.place, answer.letter, answer.valid, file, mark, note].join(","));
    keyLines.push([post, answer.letter, answer.candidate].join(","));
  }
}

await writeFile(join(folder, "marks.csv"), `${marks.join("\n")}\n`);
await writeFile(join(folder, "marks-key.csv"), `${keyLines.join("\n")}\n`);
console.log(`${marks.length - 1} answers from ${runs.length} runs: ${folder}`);
