import { createApp } from "@paste-and-taste/api/app";
import { expect, it } from "vitest";
import { ApiError, createApiClient } from "../src/index.ts";

// The real application, called in process: `fetch` hands each request to it.
const app = createApp({ APP_ENV: "development" });
const client = createApiClient({
  baseUrl: "http://api.test",
  fetch: async (request) => app.fetch(request),
});

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
