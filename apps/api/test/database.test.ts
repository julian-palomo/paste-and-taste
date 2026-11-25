import { connect, createServer, type Server, type Socket } from "node:net";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { withDatabase } from "../src/database/database.ts";
import { DatabaseUnavailableError } from "../src/database/database-unavailable-error.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

const LIMIT_MS = 500;
const CONNECT_DELAY_MS = 300;

let postgres: TestPostgres;
let proxy: Server;
let proxyPort: number;
const sockets: Socket[] = [];

// Forwards to the test Postgres, but only CONNECT_DELAY_MS after a client
// connects: connecting spends most of the limit, and the query gets the rest.
beforeAll(async () => {
  postgres = await startTestPostgres();
  const target = new URL(postgres.connectionString);
  proxy = createServer((socket) => {
    sockets.push(socket);
    socket.on("error", () => {});
    setTimeout(() => {
      const upstream = connect(Number(target.port), target.hostname);
      sockets.push(upstream);
      upstream.on("error", () => {});
      socket.pipe(upstream).pipe(socket);
    }, CONNECT_DELAY_MS);
  });
  proxyPort = await new Promise<number>((resolve) => {
    proxy.listen(0, "127.0.0.1", () => {
      const address = proxy.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
});

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await postgres.stop();
});

it("gives connecting and the query one deadline together, and still closes the client", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const end = vi.spyOn(Client.prototype, "end");
  const source = { connectionString: () => `postgres://postgres@127.0.0.1:${proxyPort}/postgres` };

  const started = performance.now();
  const outcome = withDatabase(source, () => new Promise(() => {}), LIMIT_MS);
  await expect(outcome).rejects.toBeInstanceOf(DatabaseUnavailableError);
  const elapsed = performance.now() - started;

  // Two separate limits would end at CONNECT_DELAY_MS + LIMIT_MS, 800 ms; one
  // deadline ends near 500. The margin is for slow CI machines.
  expect(elapsed).toBeLessThan(750);
  expect(end).toHaveBeenCalledTimes(1);
});

it("rethrows an error from the work as it is, and still closes the client", async () => {
  const end = vi.spyOn(Client.prototype, "end");
  const bug = new TypeError("a bug in the work");

  const outcome = withDatabase({ connectionString: () => postgres.connectionString }, async () => {
    throw bug;
  });

  await expect(outcome).rejects.toBe(bug);
  expect(end).toHaveBeenCalledTimes(1);
});
