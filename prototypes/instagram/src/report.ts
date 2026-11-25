// What the script prints: a line per post and route, then the totals as a
// Markdown table for the pull request. Posts are named by number only.

import { KINDS, type Kind, type Measurement, type Post, type RouteName } from "./types.ts";

export type Result = { post: Post; measurement: Measurement };

function yesNo(value: boolean): string {
  return value ? "yes" : "no ";
}

export function formatLine({ post, measurement: m }: Result): string {
  return [
    `post ${String(post.number).padStart(2, "0")}`,
    post.kind.padEnd(14),
    m.route.padEnd(6),
    String(m.status ?? "-").padStart(3),
    m.outcome.padEnd(14),
    `caption ${yesNo(m.caption)}`,
    `video ${yesNo(m.video)}`,
    `images ${m.images ?? "-"}`,
    `${m.ms} ms`,
  ].join("  ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : Math.round(((sorted[middle - 1] ?? 0) + upper) / 2);
}

/** "login-redirect 302 ×2; stopped ×1", for every outcome but ok. */
function failures(measurements: Measurement[]): string {
  const byOutcome = new Map<string, { count: number; statuses: Set<number> }>();
  for (const m of measurements) {
    if (m.outcome === "ok") continue;
    const entry = byOutcome.get(m.outcome) ?? { count: 0, statuses: new Set<number>() };
    entry.count += 1;
    if (m.status !== null) entry.statuses.add(m.status);
    byOutcome.set(m.outcome, entry);
  }
  return [...byOutcome]
    .map(([outcome, { count, statuses }]) =>
      [outcome, [...statuses].sort().join("/"), `×${count}`].filter(Boolean).join(" "),
    )
    .join("; ");
}

function images(kind: Kind, rows: Result[]): string {
  if (kind === "reel-own-audio" || kind === "reel-music") return "-";
  const got = rows.reduce((sum, { measurement }) => sum + (measurement.images ?? 0), 0);
  if (kind === "unknown") return `${got}/?`;
  const expected = rows.reduce((sum, { post }) => sum + (post.images ?? 1), 0);
  return `${got}/${expected}`;
}

function row(route: RouteName, kind: Kind, rows: Result[]): string {
  if (rows.length === 0) return `| ${route} | ${kind} | 0 | not in the sample | | | | | | |`;
  const ms = rows.map((r) => r.measurement).filter((m) => m.outcome !== "stopped");
  const times = ms.map((m) => m.ms);
  const count = (test: (m: Measurement) => boolean) =>
    rows.filter((r) => test(r.measurement)).length;
  return [
    "",
    route,
    kind,
    rows.length,
    count((m) => m.outcome === "ok"),
    `${count((m) => m.caption)}/${rows.length}`,
    `${count((m) => m.video)}/${rows.length}`,
    images(kind, rows),
    times.length > 0 ? `${median(times)} ms` : "-",
    times.length > 0 ? `${Math.max(...times)} ms` : "-",
    failures(rows.map((r) => r.measurement)),
    "",
  ]
    .join(" | ")
    .trim();
}

/**
 * Totals per route and kind. A post oEmbed answers as private is left out of
 * them and listed apart: private accounts are out of the spike's scope, and the
 * embed view sends such a post to the login page, which isn't a rate limit.
 */
export function formatTotals(results: Result[], routes: readonly RouteName[]): string {
  const privatePosts = new Set(
    results.filter((r) => r.measurement.outcome === "private").map((r) => r.post.number),
  );
  const counted = results.filter((r) => !privatePosts.has(r.post.number));

  const lines = [
    "| Route | Kind | Posts | OK | Caption | Video address | Images | Median | Worst | Failures |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const route of routes) {
    for (const kind of KINDS) {
      lines.push(
        row(
          route,
          kind,
          counted.filter((r) => r.measurement.route === route && r.post.kind === kind),
        ),
      );
    }
  }

  if (privatePosts.size > 0) {
    lines.push("", "Private posts, left out of the totals:", "");
    for (const number of [...privatePosts].sort((a, b) => a - b)) {
      const own = results.filter((r) => r.post.number === number);
      const kind = own[0]?.post.kind ?? "";
      const outcomes = own
        .map(({ measurement: m }) => `${m.route} ${m.outcome} ${m.status ?? "-"}`)
        .join(", ");
      lines.push(`- post ${String(number).padStart(2, "0")} (${kind}): ${outcomes}`);
    }
  }
  return lines.join("\n");
}
