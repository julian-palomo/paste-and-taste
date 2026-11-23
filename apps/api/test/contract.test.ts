import { readFileSync } from "node:fs";
import { Validator } from "@cfworker/json-schema";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";

// The committed document, not one generated here: the contract is what
// clients were built against.
const document = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
const app = createApp({ APP_ENV: "development" });

type Operation = { responses: Record<string, DocumentedResponse> };
type DocumentedResponse = { content?: Record<string, { schema: object }> };

// A request meant to succeed for each operation, keyed "<method> <path>" as
// the document writes them. Every operation needs one: its path requested as
// written (a `{id}` left in, no body, no login) would get an error, which the
// `default` response accepts, and the success schema would go unchecked. When
// `init` has no method, the operation's is used.
const successfulRequests: Record<string, { path: string; init?: RequestInit }> = {
  "get /health": { path: "/health" },
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
    const request = successfulRequests[key];
    if (!request) {
      throw new Error(`no successful request for ${key}: add one to successfulRequests`);
    }

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
