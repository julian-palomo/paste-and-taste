import { readFileSync } from "node:fs";
import { Validator } from "@cfworker/json-schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { cookieHeader, json, LOGIN_SETTINGS, recordingSender } from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

// The committed document, not one generated here: the contract is what
// clients were built against.
const document = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
// A real Postgres, so the routes that touch the database answer their success.
let postgres: TestPostgres;
beforeAll(async () => {
  postgres = await startTestPostgres();
});
afterAll(async () => {
  await postgres.stop();
});
// The login's settings and a sender that keeps the codes, so the login
// routes can succeed too.
const recorder = recordingSender();
const app = createApp(
  { APP_ENV: "development", ...LOGIN_SETTINGS },
  { connectionString: () => postgres.connectionString },
  { codeSender: recorder.sender },
);

type Operation = { responses: Record<string, DocumentedResponse> };
type DocumentedResponse = { content?: Record<string, { schema: object }> };

type SuccessfulRequest = { path: string; init?: RequestInit };

// Signs in a new address with a code and returns its cookies, for the
// operations that need a session.
let signIns = 0;
async function signedInCookie(): Promise<string> {
  signIns += 1;
  const email = `contract-${signIns}@example.com`;
  await app.request("/login/code", json({ email }));
  const code = recorder.lastCodeFor(email) ?? "";
  return cookieHeader(
    await app.request("/login/sign-in", json({ email, code, rememberMe: false })),
  );
}

// A request meant to succeed for each operation, keyed "<method> <path>" as
// the document writes them. Every operation needs one: its path requested as
// written (a `{id}` left in, no body, no login) would get an error, which the
// `default` response accepts, and the success schema would go unchecked. When
// `init` has no method, the operation's is used. An operation that needs
// state first (a code, a session) gets a function that prepares it.
const successfulRequests: Record<string, SuccessfulRequest | (() => Promise<SuccessfulRequest>)> = {
  "get /health": { path: "/health" },
  "get /wake": { path: "/wake" },
  "post /login/code": { path: "/login/code", init: json({ email: "contract-code@example.com" }) },
  "post /login/sign-in": async () => {
    const email = "contract-sign-in@example.com";
    await app.request("/login/code", json({ email }));
    const code = recorder.lastCodeFor(email) ?? "";
    return { path: "/login/sign-in", init: json({ email, code, rememberMe: true }) };
  },
  "get /login/session": async () => ({
    path: "/login/session",
    init: { headers: { cookie: await signedInCookie() } },
  }),
  "post /login/sign-out": async () => ({
    path: "/login/sign-out",
    init: { headers: { cookie: await signedInCookie() } },
  }),
};

const operations = Object.entries(
  document.paths as Record<string, Record<string, Operation>>,
).flatMap(([path, item]) =>
  Object.entries(item).map(([method, operation]) => ({
    key: `${method} ${path}`,
    path,
    method,
    operation,
  })),
);

// A schema from the document, with the document's components beside it so
// its `#/components/schemas/...` references resolve.
function validate(schema: object, body: unknown) {
  return new Validator({ ...schema, components: document.components }, "2020-12").validate(body);
}

async function bodyAndType(response: Response) {
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0] ?? "";
  return { contentType, body: await response.json() };
}

describe("the real application against the committed document", () => {
  it("documents at least one operation", () => {
    expect(operations.length).toBeGreaterThan(0);
  });

  it.each(operations)("$method $path answers as documented", async ({ key, method, operation }) => {
    const entry = successfulRequests[key];
    if (!entry) {
      throw new Error(`no successful request for ${key}: add one to successfulRequests`);
    }
    const request = typeof entry === "function" ? await entry() : entry;

    const response = await app.request(request.path, {
      method: method.toUpperCase(),
      ...request.init,
    });
    const { contentType, body } = await bodyAndType(response);
    // Only a 2xx the operation documents by its number. Never fall back to
    // `default`: it is Problem Details, so any error would pass.
    const documented = response.ok ? operation.responses[String(response.status)] : undefined;
    if (!documented) {
      throw new Error(
        `${key} answered ${response.status}, not a documented success: ${JSON.stringify(body)}`,
      );
    }
    const schema = documented.content?.[contentType]?.schema;

    expect(schema, `no schema for ${response.status} ${contentType}`).toBeDefined();
    expect(validate(schema as object, body).errors).toEqual([]);
  });

  it("names only operations the document has", () => {
    const documented = operations.map(({ key }) => key);

    expect(Object.keys(successfulRequests).filter((key) => !documented.includes(key))).toEqual([]);
  });

  it("answers an unknown route with the documented Problem Details", async () => {
    const response = await app.request("/no-such-route");
    const { contentType, body } = await bodyAndType(response);

    expect(contentType).toBe("application/problem+json");
    expect(validate({ $ref: "#/components/schemas/ProblemDetails" }, body).errors).toEqual([]);
  });
});
