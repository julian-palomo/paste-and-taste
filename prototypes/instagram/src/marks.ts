// Usage: pnpm -C prototypes/instagram marks <absolute path to a run folder>
// Reads the owner's filled marks.csv and the separate marks-key.csv, and prints
// the counts of good, fixable and wrong per candidate and per place. The owner
// marks blind; only this command joins the letters to the candidates.

import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const MARKS = ["good", "fixable", "wrong"] as const;
type Mark = (typeof MARKS)[number];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function rows(text: string): string[][] {
  return text
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

const [runDir, ...extra] = process.argv.slice(2);
if (!runDir || !isAbsolute(runDir) || extra.length > 0) {
  fail("Usage: pnpm -C prototypes/instagram marks <absolute path to a run folder>");
}

const key = new Map<string, string>();
for (const [post, letter, candidate] of rows(
  await readFile(join(runDir, "marks-key.csv"), "utf8"),
)) {
  key.set(`${post}.${letter}`, candidate ?? "?");
}

type Counted = { candidate: string; place: string; mark: Mark };
const counted: Counted[] = [];
for (const [index, row] of rows(await readFile(join(runDir, "marks.csv"), "utf8")).entries()) {
  const [post, place, letter, , , mark] = row;
  const sheetRow = index + 2;
  if (!MARKS.some((allowed) => allowed === mark)) {
    fail(
      `marks.csv row ${sheetRow} (post ${post}, letter ${letter}): mark must be good, fixable or wrong`,
    );
  }
  const candidate = key.get(`${post}.${letter}`);
  if (!candidate)
    fail(`marks.csv row ${sheetRow}: post ${post}, letter ${letter} is not in the key`);
  counted.push({ candidate, place: place || "-", mark: mark as Mark });
}

function line(label: string, own: Counted[]): string {
  const count = (mark: Mark) => own.filter((row) => row.mark === mark).length;
  return `| ${label} | ${own.length} | ${count("good")} | ${count("fixable")} | ${count("wrong")} |`;
}

const candidates = [...new Set(counted.map((row) => row.candidate))].sort();
const places = [...new Set(counted.map((row) => row.place))].sort();

console.log("| Candidate | Marked | Good | Fixable | Wrong |");
console.log("| --- | --- | --- | --- | --- |");
for (const candidate of candidates) {
  console.log(
    line(
      candidate,
      counted.filter((row) => row.candidate === candidate),
    ),
  );
}
console.log("\n| Candidate, place | Marked | Good | Fixable | Wrong |");
console.log("| --- | --- | --- | --- | --- |");
for (const candidate of candidates) {
  for (const place of places) {
    const own = counted.filter((row) => row.candidate === candidate && row.place === place);
    if (own.length > 0) console.log(line(`${candidate}, ${place}`, own));
  }
}
