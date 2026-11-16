import { describe, expect, it } from "vitest";
import { checkApi } from "../src/smoke/check-api.ts";

const BASE = "https://api.example.test";

const healthy = () => json(200, { status: "ok", environment: "preview" });
const notFoundProblem = () =>
  json(
    404,
    { type: "about:blank", title: "Not Found", status: 404, detail: "Cannot GET /x" },
    "application/problem+json; charset=utf-8",
  );

function json(status: number, body: unknown, contentType = "application/json; charset=utf-8") {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });
}

// Answers /health with `health` and every other path with `other`.
function fakeFetch(health: () => Response, other: () => Response) {
  return async (url: string) => (new URL(url).pathname === "/health" ? health() : other());
}

describe("checkApi", () => {
  it("finds nothing wrong when both routes answer as specified", async () => {
    expect(await checkApi(BASE, fakeFetch(healthy, notFoundProblem))).toEqual([]);
  });

  it("reports /health answering with another status", async () => {
    const failures = await checkApi(
      BASE,
      fakeFetch(() => json(503, {}), notFoundProblem),
    );
    expect(failures).toEqual([expect.stringContaining("/health")]);
  });

  it("reports /health answering with another body", async () => {
    const wrongBody = () => json(200, { status: "ok", environment: "staging" });
    const failures = await checkApi(BASE, fakeFetch(wrongBody, notFoundProblem));
    expect(failures).toEqual([expect.stringContaining("/health")]);
  });

  it("reports an unknown route that isn't a problem", async () => {
    const plain404 = () => json(404, { statusCode: 404, message: "Cannot GET /x" });
    const failures = await checkApi(BASE, fakeFetch(healthy, plain404));
    expect(failures).toEqual([expect.stringContaining("unknown route")]);
  });

  it("reports an unknown route that doesn't answer 404", async () => {
    const failures = await checkApi(BASE, fakeFetch(healthy, healthy));
    expect(failures).toEqual([expect.stringContaining("unknown route")]);
  });
});
