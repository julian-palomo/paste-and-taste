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

const operations = Object.entries(
  document.paths as Record<string, Record<string, Operation>>,
).flatMap(([path, item]) =>
  Object.entries(item).map(([method, operation]) => ({ path, method, operation })),
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

  it.each(operations)(
    "$method $path answers as documented",
    async ({ path, method, operation }) => {
      const response = await app.request(path, { method: method.toUpperCase() });
      const documented =
        operation.responses[String(response.status)] ?? operation.responses.default;
      const { contentType, body } = await bodyAndType(response);
      const schema = documented?.content?.[contentType]?.schema;

      expect(schema, `no schema for ${response.status} ${contentType}`).toBeDefined();
      expect(validate(schema as object, body).errors).toEqual([]);
    },
  );

  it("answers an unknown route with the documented Problem Details", async () => {
    const response = await app.request("/no-such-route");
    const { contentType, body } = await bodyAndType(response);

    expect(contentType).toBe("application/problem+json");
    expect(validate({ $ref: "#/components/schemas/ProblemDetails" }, body).errors).toEqual([]);
  });
});
