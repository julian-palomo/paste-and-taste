import { describe, expect, it } from "vitest";
import { withWake } from "../src/wake/wake.ts";

const BASE_URL = "http://api.test";
const PAGE_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

// A page, as Start would answer it.
const page = async () => new Response("page", { status: 200 });

// What the API's address answers when the database can't be reached.
const failingApi = async () =>
  Response.json(
    {
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The database is down.",
    },
    { status: 503, headers: { "Content-Type": "application/problem+json" } },
  );

// What fetch does with the API stopped.
const stoppedApi = async (): Promise<Response> => {
  throw new Error("Network connection lost.");
};

// An API that never answers.
const silentApi = () => new Promise<Response>(() => {});

const okApi = async () => Response.json({ status: "awake" });

// The wrapped handler, with every request to the API, every promise handed to
// waitUntil and every log line recorded.
function serve(api: (request: Request) => Promise<Response>) {
  const sent: Request[] = [];
  const kept: Promise<unknown>[] = [];
  const logged: string[] = [];
  const handle = withWake(page, {
    api: {
      baseUrl: BASE_URL,
      fetch: (request) => {
        sent.push(request);
        return api(request);
      },
    },
    waitUntil: (promise) => kept.push(promise),
    log: (line) => logged.push(line),
  });
  return { handle, sent, kept, logged };
}

const request = (path: string, init: RequestInit = {}) =>
  new Request(`http://web.test${path}`, init);
const pageLoad = (path: string) => request(path, { headers: { Accept: PAGE_ACCEPT } });

// Settled or not, once every callback already queued has run.
async function isPending(promise: Promise<unknown>) {
  const pending = Symbol("pending");
  const settled = await Promise.race([
    promise.then(
      () => "settled",
      () => "settled",
    ),
    new Promise((resolve) => setTimeout(() => resolve(pending), 0)),
  ]);
  return settled === pending;
}

async function expectPage(response: Response) {
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("page");
}

it("sends exactly one GET /wake through the configured fetch when a page loads", async () => {
  const { handle, sent, kept } = serve(okApi);

  await expectPage(await handle(pageLoad("/es")));
  await Promise.all(kept);

  expect(sent.map((sentRequest) => `${sentRequest.method} ${sentRequest.url}`)).toEqual([
    `GET ${BASE_URL}/wake`,
  ]);
  expect(kept).toHaveLength(1);
});

it("answers the page while the wake is still pending", async () => {
  const { handle, kept } = serve(silentApi);

  await expectPage(await handle(pageLoad("/es")));

  expect(kept).toHaveLength(1);
  expect(await isPending(kept[0] as Promise<unknown>)).toBe(true);
});

describe.each([
  ["an API error", failingApi, "wake: the API answered 503"],
  ["an unreachable API", stoppedApi, "wake: the API was unreachable"],
])("with %s", (_, api, line) => {
  it("answers the page as usual, and logs the failure without rejecting", async () => {
    const { handle, kept, logged } = serve(api);

    await expectPage(await handle(pageLoad("/es")));

    await expect(Promise.all(kept)).resolves.toBeDefined();
    expect(logged).toEqual([line]);
  });
});

describe("sends no wake", () => {
  it.each([
    [
      "a server function call",
      request("/_serverFn/abc", { method: "POST", headers: { Accept: PAGE_ACCEPT } }),
    ],
    ["a server function read", request("/_serverFn/abc", { headers: { Accept: PAGE_ACCEPT } })],
    ["the favicon", request("/favicon.ico", { headers: { Accept: "image/avif,image/webp,*/*" } })],
    ["a request that doesn't ask for HTML", request("/es", { headers: { Accept: "*/*" } })],
  ])("for %s", async (_, nonPage) => {
    const { handle, sent, kept } = serve(okApi);

    await expectPage(await handle(nonPage));

    expect(sent).toEqual([]);
    expect(kept).toEqual([]);
  });
});
