import { readFileSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { Validator } from "@cfworker/json-schema";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

const document = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));

function isProblemDetails(body: unknown) {
  const schema = { $ref: "#/components/schemas/ProblemDetails", components: document.components };
  return new Validator(schema, "2020-12").validate(body).valid;
}

function appWith(connectionString: string) {
  return createApp({ APP_ENV: "development" }, { connectionString: () => connectionString });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /wake with the database up", () => {
  it("answers 200 awake, and is never stored", async () => {
    const response = await appWith(postgres.connectionString).request("/wake");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "awake" });
  });

  it("opens its own client for each request and closes it", async () => {
    const connect = vi.spyOn(Client.prototype, "connect");
    const end = vi.spyOn(Client.prototype, "end");
    const app = appWith(postgres.connectionString);

    await app.request("/wake");
    await app.request("/wake");

    expect(connect).toHaveBeenCalledTimes(2);
    const [first, second] = connect.mock.contexts;
    expect(first).not.toBe(second);
    expect(end.mock.contexts).toEqual([first, second]);
  });
});

describe("GET /wake with the database down", () => {
  // A port nothing listens on: the connection is refused at once.
  async function closedPort() {
    const server = createServer();
    const port = await listen(server);
    await close(server);
    return port;
  }

  it("answers 503 Problem Details at once when the connection is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const end = vi.spyOn(Client.prototype, "end");
    const app = appWith(`postgres://postgres@127.0.0.1:${await closedPort()}/postgres`);

    const response = await app.request("/wake");
    const body = (await response.json()) as { detail: string };

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(isProblemDetails(body)).toBe(true);
    expect(body.detail).toBe("The database could not be reached.");
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("answers 503 Problem Details within 6 seconds when the database never answers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Accepts the connection and never says a word, so only the deadline
    // can end the request.
    const sockets: Socket[] = [];
    const silent = createServer((socket) => {
      sockets.push(socket);
    });
    const port = await listen(silent);
    const app = appWith(`postgres://postgres@127.0.0.1:${port}/postgres`);

    const started = performance.now();
    const response = await app.request("/wake");
    const elapsed = performance.now() - started;
    const body = (await response.json()) as { detail: string };
    for (const socket of sockets) socket.destroy();
    await close(silent);

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(isProblemDetails(body)).toBe(true);
    expect(body.detail).toBe("The database did not answer within 5 seconds.");
    expect(elapsed).toBeLessThan(6000);
  }, 10_000);
});
