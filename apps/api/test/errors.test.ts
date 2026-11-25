import { HTTPException } from "hono/http-exception";
import { afterEach, expect, it, vi } from "vitest";
import { createApp, noDatabase } from "../src/app.ts";
import { AppError } from "../src/errors/app-error.ts";

const INTERNAL_MESSAGE = "internal detail: db-node-7 refused the query";

class TeapotError extends AppError {
  readonly type = "https://example.com/problems/teapot";
  readonly title = "The server is a teapot";
  readonly status = 418;
}

// Routes that exist only in these tests, added to the real application:
// nothing in it fails on purpose.
const app = createApp({ APP_ENV: "development" }, noDatabase);
app.get("/broken", () => {
  throw new Error(INTERNAL_MESSAGE);
});
app.get("/broken/unauthorized", () => {
  throw new HTTPException(401);
});
app.get("/broken/teapot", () => {
  throw new TeapotError("It brews tea, not coffee.");
});

it("answers an unknown route with a 404 problem", async () => {
  const response = await app.request("/no-such-route");

  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  expect(await response.json()).toEqual({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: expect.any(String),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("answers an unexpected error with a 500 problem that hides it, and logs it", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  const response = await app.request("/broken");
  const text = await response.text();

  expect(response.status).toBe(500);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  expect(JSON.parse(text)).toEqual({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: expect.any(String),
  });
  expect(text).not.toContain(INTERNAL_MESSAGE);
  expect(text).not.toMatch(/\bat \S+:\d+/);
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: INTERNAL_MESSAGE }));
});

it("answers a named error with its own problem", async () => {
  const response = await app.request("/broken/teapot");

  expect(response.status).toBe(418);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  expect(await response.json()).toEqual({
    type: "https://example.com/problems/teapot",
    title: "The server is a teapot",
    status: 418,
    detail: "It brews tea, not coffee.",
  });
});

it("answers an HTTP error from the framework with its status", async () => {
  const response = await app.request("/broken/unauthorized");

  expect(response.status).toBe(401);
  expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
  expect(await response.json()).toEqual({
    type: "about:blank",
    title: "Unauthorized",
    status: 401,
    detail: "Unauthorized",
  });
});
