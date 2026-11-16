// What the recipe command prints and writes: a line per post and candidate,
// tables for the pull request, and the owner's marks sheet. The sheet names
// candidates by a letter shuffled per post, and the key is a separate file, so
// the owner marks without knowing which candidate wrote what.

import { randomInt } from "node:crypto";
import type { CandidateId } from "./candidates/candidate.ts";
import type { Place } from "./types.ts";

export type Step = "read" | "download" | "extract" | "transcribe" | "write";

export type Row = {
  post: number;
  place: Place | null;
  candidate: CandidateId;
  letter: string;
  valid: boolean;
  steps: { step: Step; ms: number }[];
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number | null;
  costUsd: number;
  error: string | null;
  recipeFile: string;
};

/** `count` distinct letters in a random order, one per candidate of a post. */
export function shuffledLetters(count: number): string[] {
  const letters = ["a", "b", "c"].slice(0, count);
  for (let i = letters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [letters[i], letters[j]] = [letters[j] ?? "", letters[i] ?? ""];
  }
  return letters;
}

function totalMs(row: Row): number {
  return row.steps.reduce((sum, step) => sum + step.ms, 0);
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatLine(row: Row): string {
  return [
    `post ${String(row.post).padStart(2, "0")}`,
    (row.place ?? "-").padEnd(8),
    row.candidate,
    (row.error ?? (row.valid ? "valid" : "invalid")).padEnd(9),
    ...row.steps.map((step) => `${step.step} ${seconds(step.ms)}`),
    `total ${seconds(totalMs(row))}`,
    `in ${row.inputTokens} tok`,
    `out ${row.outputTokens} tok`,
    `audio ${row.audioSeconds === null ? "-" : `${Math.round(row.audioSeconds)} s`}`,
    `${row.costUsd.toFixed(4)} USD`,
  ].join("  ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function summary(rows: Row[]): string[] {
  const times = rows.map(totalMs);
  const costs = rows.map((row) => row.costUsd);
  return [
    String(rows.length),
    `${rows.filter((row) => row.valid).length}/${rows.length}`,
    seconds(median(times)),
    seconds(Math.max(...times)),
    `${median(costs).toFixed(4)} USD`,
    `${Math.max(...costs).toFixed(4)} USD`,
    `${costs.reduce((sum, cost) => sum + cost, 0).toFixed(4)} USD`,
  ];
}

export function formatTables(rows: Row[]): string {
  const header = "| Posts | Valid | Median time | Worst time | Median cost | Worst cost | Spent |";
  const rule = "| --- | --- | --- | --- | --- | --- | --- |";
  const lines: string[] = [];
  const candidates = [...new Set(rows.map((row) => row.candidate))].sort();

  lines.push(`| Candidate ${header}`, `| --- ${rule}`);
  for (const candidate of candidates) {
    const own = rows.filter((row) => row.candidate === candidate);
    lines.push(`| ${candidate} | ${summary(own).join(" | ")} |`);
  }

  lines.push("", `| Candidate | Place ${header}`, `| --- | --- ${rule}`);
  const places = [...new Set(rows.map((row) => row.place ?? "-"))].sort();
  for (const candidate of candidates) {
    for (const place of places) {
      const own = rows.filter((row) => row.candidate === candidate && (row.place ?? "-") === place);
      if (own.length > 0) lines.push(`| ${candidate} | ${place} | ${summary(own).join(" | ")} |`);
    }
  }
  return lines.join("\n");
}

/** The sheet the owner fills: an invalid answer comes marked `wrong`. */
export function marksCsv(rows: Row[]): string {
  const lines = ["post,place,letter,valid,recipe_file,mark,note"];
  for (const row of [...rows].sort((a, b) => a.post - b.post || a.letter.localeCompare(b.letter))) {
    const mark = row.valid ? "" : "wrong";
    const note = row.valid ? "" : "invalid";
    lines.push(
      [row.post, row.place ?? "", row.letter, row.valid, row.recipeFile, mark, note].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** The key from letters to candidates, which only `marks` reads. */
export function keyCsv(rows: Row[]): string {
  const lines = ["post,letter,candidate"];
  for (const row of rows) lines.push([row.post, row.letter, row.candidate].join(","));
  return `${lines.join("\n")}\n`;
}
