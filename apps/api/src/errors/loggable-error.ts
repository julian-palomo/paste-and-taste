import { DrizzleQueryError } from "drizzle-orm";

// An unexpected error as one log line: its name, message and stack, with
// nothing that can hold a request's values. A failed query's message and the
// first line of its stack carry the query's params, such as an email address
// in a limiter key, so it keeps only its SQL. Its cause, the Postgres error,
// can repeat a value in `message` or `detail`, so it keeps only `name` and
// `code`. Something thrown that isn't an Error is named by its type alone.
export function loggableError(error: unknown): string {
  if (error instanceof DrizzleQueryError) {
    const lines = [`DrizzleQueryError: Failed query: ${error.query}`, ...frames(error)];
    if (error.cause) lines.push(`cause: ${causeSummary(error.cause)}`);
    return lines.join("\n");
  }
  if (error instanceof Error) {
    return [`${error.name}: ${error.message}`, ...frames(error)].join("\n");
  }
  return `A ${typeof error} was thrown, not an Error.`;
}

// The stack's "at …" lines, without the lines before them, which repeat the
// message.
function frames(error: Error): string[] {
  return (error.stack ?? "").split("\n").filter((line) => /^\s+at /.test(line));
}

function causeSummary(cause: unknown): string {
  if (!(cause instanceof Error)) return `a ${typeof cause}`;
  const code = "code" in cause && typeof cause.code === "string" ? cause.code : "no code";
  return `${cause.name} (${code})`;
}
