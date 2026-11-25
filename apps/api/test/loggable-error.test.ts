import { DrizzleQueryError } from "drizzle-orm";
import { expect, it } from "vitest";
import { loggableError } from "../src/errors/loggable-error.ts";

const ADDRESS = "someone@example.com";
const QUERY = 'insert into "request_limit" ("key", "count") values ($1, $2)';

// A Postgres error as the pg driver builds it: the SQLSTATE in `code`, and
// values that may sit in `message` or in `detail`.
function postgresError(fields: { message: string; code: string; detail?: string }): Error {
  return Object.assign(new Error(fields.message), {
    name: "error",
    code: fields.code,
    detail: fields.detail,
  });
}

it("keeps a plain error's name, message and stack", () => {
  const error = new TypeError("the recipe has no steps");

  const line = loggableError(error);

  expect(line).toContain("TypeError: the recipe has no steps");
  expect(line).toMatch(/\n\s+at \S/);
});

it("keeps a failed query's SQL but not its params", () => {
  const error = new DrizzleQueryError(QUERY, [`code:email:${ADDRESS}`, 1]);

  const line = loggableError(error);

  expect(line).toContain("DrizzleQueryError");
  expect(line).toContain(QUERY);
  expect(line).toMatch(/\n\s+at \S/);
  expect(line).not.toContain(ADDRESS);
});

it("keeps only the name and code of a Postgres cause whose message holds a value", () => {
  const cause = postgresError({
    message: `invalid input syntax for type uuid: "${ADDRESS}"`,
    code: "22P02",
  });
  const error = new DrizzleQueryError(QUERY, [ADDRESS], cause);

  const line = loggableError(error);

  expect(line).toContain("22P02");
  expect(line).not.toContain(ADDRESS);
});

it("keeps only the name and code of a Postgres cause whose detail holds a value", () => {
  const cause = postgresError({
    message: 'duplicate key value violates unique constraint "user_email_unique"',
    code: "23505",
    detail: `Key (email)=(${ADDRESS}) already exists.`,
  });
  const error = new DrizzleQueryError(QUERY, [ADDRESS], cause);

  const line = loggableError(error);

  expect(line).toContain("23505");
  expect(line).not.toContain(ADDRESS);
});

it("names what was thrown when it isn't an error, without its value", () => {
  const line = loggableError(`code:email:${ADDRESS}`);

  expect(line).toContain("string");
  expect(line).not.toContain(ADDRESS);
});
