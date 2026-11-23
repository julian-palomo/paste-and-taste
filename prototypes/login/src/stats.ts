import type { Outcome } from "./client.ts";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return Number.NaN;
  return sorted.length % 2
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** One line: the count, each status with its count, then median and worst of the expected answers (no error). */
export function summarize(outcomes: Outcome[]): string {
  const statuses = new Map<number, number>();
  for (const outcome of outcomes)
    statuses.set(outcome.status, (statuses.get(outcome.status) ?? 0) + 1);
  const counts = [...statuses].map(([status, count]) => `${status}×${count}`).join(" ");
  const ok = outcomes.filter((outcome) => outcome.status !== 0 && !outcome.error);
  const times = ok.map((outcome) => outcome.ms);
  const timing = times.length
    ? `median ${median(times).toFixed(0)} ms, worst ${Math.max(...times).toFixed(0)} ms over ${times.length}`
    : "no successful answer";
  return `n=${outcomes.length} [${counts}] ${timing}`;
}

/** Each distinct failure with its count: status and error body. */
export function failures(outcomes: Outcome[]): string[] {
  const seen = new Map<string, number>();
  for (const outcome of outcomes) {
    if (!outcome.error) continue;
    const key = `${outcome.status} ${outcome.error.replaceAll(/\s+/g, " ")}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].map(([key, count]) => `  ${count}× ${key}`);
}
