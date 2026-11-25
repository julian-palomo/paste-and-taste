import { createApp, noDatabase } from "@paste-and-taste/api/app";
import { expect, it } from "vitest";
import { ApiError, ApiUnreachableError, createApiClient } from "../src/index.ts";

// The real application, called in process: `fetch` hands each request to it.
const app = createApp({ APP_ENV: "development" }, noDatabase);
const client = createApiClient({
  baseUrl: "http://api.test",
  fetch: async (request) => app.fetch(request),
});

// A client whose every call gets what `fetch` does here.
function answering(fetch: () => Promise<Response>) {
  return createApiClient({ baseUrl: "http://api.test", fetch });
}

it("calls /health and reads its fields with their types", async () => {
  const health = await client.get("/health");

  const status: "ok" = health.status;
  const environment: "development" | "preview" | "production" = health.environment;
  // @ts-expect-error The health response has no `uptime`.
  health.uptime;

  expect({ status, environment }).toEqual({ status: "ok", environment: "development" });
});

it("throws ApiError with the Problem Details for an unknown route", async () => {
  // A path outside the document: the types forbid it, so it is cast.
  const error = await client.get("/no-such-route" as "/health").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 404,
    problem: { type: "about:blank", title: "Not Found", status: 404, detail: expect.any(String) },
  });
});

it("builds the problem from the status when the error body isn't Problem Details", async () => {
  // A gateway in front of the API can answer with its own HTML page.
  const behindGateway = createApiClient({
    baseUrl: "http://api.test",
    fetch: async () =>
      new Response("<html><body>Bad gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
  });

  const error = await behindGateway.get("/health").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 502,
    problem: {
      type: "about:blank",
      title: expect.any(String),
      status: 502,
      detail: expect.any(String),
    },
  });
});

it("throws ApiUnreachableError with the platform's error when fetch rejects", async () => {
  // What fetch does with no network.
  const offline = new TypeError("fetch failed");

  const error = await answering(async () => {
    throw offline;
  })
    .get("/health")
    .catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiUnreachableError);
  expect(error).toMatchObject({ cause: offline });
});

it("throws ApiUnreachableError when a 200's body isn't JSON", async () => {
  // A captive portal answers every address with its own page.
  const error = await answering(
    async () =>
      new Response("<html><body>Sign in to the Wi-Fi</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  )
    .get("/health")
    .catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiUnreachableError);
  expect(error).toMatchObject({ cause: expect.any(SyntaxError) });
});

it.each([
  ["no body", {}],
  ["Content-Length: 0", { "Content-Length": "0" }],
])("throws ApiUnreachableError when a 200 has %s", async (_, headers) => {
  const error = await answering(async () => new Response(null, { status: 200, headers }))
    .get("/health")
    .catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiUnreachableError);
});
