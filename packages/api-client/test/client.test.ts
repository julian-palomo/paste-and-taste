import { createApp, noDatabase } from "@paste-and-taste/api/app";
import { describe, expect, it } from "vitest";
import { type ApiClient, ApiError, ApiUnreachableError, createApiClient } from "../src/index.ts";

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

// A fetch that answers `response` and keeps each request it was handed.
function recording(response: () => Response) {
  const requests: Request[] = [];
  const client = createApiClient({
    baseUrl: "http://api.test",
    fetch: async (request) => {
      requests.push(request);
      return response();
    },
  });
  return { client, requests };
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

describe("post", () => {
  it("sends the body as JSON and reads the 200 with its type", async () => {
    const { client: sentClient, requests } = recording(() => json({ sent: true }));

    const result = await sentClient.post("/login/code", { body: { email: "ana@example.com" } });

    const sent: true = result.sent;
    expect(sent).toBe(true);
    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await requests[0]?.json()).toEqual({ email: "ana@example.com" });
  });

  it("calls a route that takes no body with no options", async () => {
    const { client: outClient, requests } = recording(() => json({ signedOut: true }));

    const result = await outClient.post("/login/sign-out");

    expect(result.signedOut).toBe(true);
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/login/sign-out");
  });

  it("is checked against the API's types", () => {
    // Never run: typecheck fails if any of these stops being an error.
    const typesOnly = () => {
      // @ts-expect-error /login/code takes { email }, not { mail }.
      client.post("/login/code", { body: { mail: "ana@example.com" } });
      // @ts-expect-error /health has no POST.
      client.post("/health");
      // @ts-expect-error /login/code needs its body.
      client.post("/login/code");
      // @ts-expect-error /login/code needs its body in the options too.
      client.post("/login/code", {});
      // @ts-expect-error /login/sign-out takes no body.
      client.post("/login/sign-out", { body: { email: "ana@example.com" } });
    };
    expect(typesOnly).toBeTypeOf("function");
  });

  it("gets the real API's 400 for a body it refuses", async () => {
    const error = await client
      .post("/login/code", { body: { email: "not-an-address" } })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, problem: { status: 400 } });
  });

  it("throws ApiError with the Problem Details for an unknown route", async () => {
    const error = await client.post("/no-such-route" as "/login/sign-out").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, problem: { title: "Not Found", status: 404 } });
  });

  it("builds the problem from the status when the error body isn't Problem Details", async () => {
    const error = await answering(
      async () => new Response("<html>Bad gateway</html>", { status: 502 }),
    )
      .post("/login/sign-out")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, problem: { type: "about:blank", status: 502 } });
  });

  it("throws ApiUnreachableError with the platform's error when fetch rejects", async () => {
    const offline = new TypeError("fetch failed");

    const error = await answering(async () => {
      throw offline;
    })
      .post("/login/sign-out")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiUnreachableError);
    expect(error).toMatchObject({ cause: offline });
  });

  it.each([
    ["an empty body", () => new Response(null, { status: 200 })],
    ["a body that isn't JSON", () => new Response("<html>Wi-Fi</html>", { status: 200 })],
  ])("throws ApiUnreachableError when a 200 has %s", async (_, response) => {
    const error = await answering(async () => response())
      .post("/login/sign-out")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiUnreachableError);
  });
});

describe("headers", () => {
  const headers = {
    cookie: "session=abc",
    "cf-connecting-ip": "203.0.113.7",
    "user-agent": "Test browser",
  };

  it.each([
    ["get", (c: ApiClient) => c.get("/health", { headers })],
    ["post", (c: ApiClient) => c.post("/login/sign-out", { headers })],
  ])("%s sends the headers it is given", async (_, call) => {
    const { client: recorded, requests } = recording(() =>
      json({ status: "ok", environment: "development", signedOut: true }),
    );

    await call(recorded);

    expect(requests[0]?.headers.get("cookie")).toBe("session=abc");
    expect(requests[0]?.headers.get("cf-connecting-ip")).toBe("203.0.113.7");
    expect(requests[0]?.headers.get("user-agent")).toBe("Test browser");
  });
});

describe("onSetCookie", () => {
  // Two cookies with their attributes, as Better Auth writes them.
  const first = "session_token=abc; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000";
  const second = "session_data=xyz; Path=/; HttpOnly; SameSite=Lax";
  const withCookies = (response: Response) => {
    response.headers.append("Set-Cookie", first);
    response.headers.append("Set-Cookie", second);
    return response;
  };

  it("gets every Set-Cookie of a 200, whole and in order", async () => {
    const seen: string[][] = [];

    await answering(async () => withCookies(json({ signedOut: true }))).post("/login/sign-out", {
      onSetCookie: (cookies) => seen.push(cookies),
    });

    expect(seen).toEqual([[first, second]]);
  });

  it("gets them before an ApiError is thrown", async () => {
    const seen: string[][] = [];
    const problem = { type: "about:blank", title: "Unauthorized", status: 401, detail: "No." };

    const error = await answering(async () =>
      withCookies(
        json(problem, { status: 401, headers: { "Content-Type": "application/problem+json" } }),
      ),
    )
      .get("/health", { onSetCookie: (cookies) => seen.push(cookies) })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(seen).toEqual([[first, second]]);
  });

  it("gets an empty list when the answer sets none", async () => {
    const seen: string[][] = [];

    await answering(async () => json({ signedOut: true })).post("/login/sign-out", {
      onSetCookie: (cookies) => seen.push(cookies),
    });

    expect(seen).toEqual([[]]);
  });

  it("is not called when fetch rejects", async () => {
    const seen: string[][] = [];

    await answering(async () => {
      throw new TypeError("fetch failed");
    })
      .post("/login/sign-out", { onSetCookie: (cookies) => seen.push(cookies) })
      .catch(() => {});

    expect(seen).toEqual([]);
  });
});
