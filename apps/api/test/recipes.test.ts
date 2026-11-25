import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cookieHeader, json, loginApp, recordingSender, setCookies } from "./login-helpers.ts";
import { startTestPostgres, type TestPostgres } from "./postgres.ts";

type App = ReturnType<typeof loginApp>;
type Recipe = Record<string, unknown> & { id: string; updatedAt: string };

const NINETY_DAYS = 90 * 24 * 60 * 60;

const tortilla = {
  title: "Tortilla de patatas",
  language: "es",
  servings: "4",
  time: "45 min",
  ingredients: [
    { name: "huevos", quantity: "6", unit: null },
    { name: "patatas", quantity: "500", unit: "g" },
  ],
  steps: ["Freír las patatas.", "Batir los huevos y cuajar."],
  source: "https://example.com/tortilla",
};

let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startTestPostgres();
});

afterAll(async () => {
  await postgres.stop();
});

afterEach(() => {
  vi.useRealTimers();
});

// A new user, signed in through the login's own routes.
let next = 0;
async function signedIn(
  app: App,
  recorder: ReturnType<typeof recordingSender>,
  rememberMe = false,
) {
  next += 1;
  const email = `cook-${next}@example.com`;
  const ip = `192.0.2.${next}`;
  await app.request("/login/code", json({ email }, { "cf-connecting-ip": ip }));
  const response = await app.request(
    "/login/sign-in",
    json({ email, code: recorder.lastCodeFor(email), rememberMe }, { "cf-connecting-ip": ip }),
  );
  const { user } = (await response.json()) as { user: { id: string } };
  return { userId: user.id, cookie: cookieHeader(response) };
}

function setup() {
  const recorder = recordingSender();
  return { app: loginApp(postgres, recorder.sender), recorder };
}

function put(body: unknown, cookie: string): RequestInit {
  return { ...json(body, { cookie }), method: "PUT" };
}

// The copy owner is who may change a recipe, and never part of an answer.
async function textWithoutCopyOwner(response: Response, userId: string): Promise<string> {
  const text = await response.text();
  expect(text).not.toContain(userId);
  expect(text).not.toContain("copyOwner");
  return text;
}

describe("a user's recipes", () => {
  it("adds a recipe, then lists its summary and opens it whole", async () => {
    const { app, recorder } = setup();
    const { userId, cookie } = await signedIn(app, recorder);

    const added = await app.request("/recipes", json(tortilla, { cookie }));
    const recipe = JSON.parse(await textWithoutCopyOwner(added, userId)) as Recipe;
    const listed = await app.request("/recipes", { headers: { cookie } });
    const opened = await app.request(`/recipes/${recipe.id}`, { headers: { cookie } });

    expect(added.status).toBe(201);
    expect(recipe).toEqual({
      ...tortilla,
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(listed.status).toBe(200);
    expect(JSON.parse(await textWithoutCopyOwner(listed, userId))).toEqual({
      recipes: [{ id: recipe.id, title: tortilla.title, language: tortilla.language }],
    });
    expect(opened.status).toBe(200);
    expect(JSON.parse(await textWithoutCopyOwner(opened, userId))).toEqual(recipe);
  });

  it("lists nothing for a new user, and the newest change first", async () => {
    const { app, recorder } = setup();
    const { cookie } = await signedIn(app, recorder);
    const empty = await app.request("/recipes", { headers: { cookie } });
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = (await (
      await app.request("/recipes", json(tortilla, { cookie }))
    ).json()) as Recipe;
    vi.setSystemTime(Date.now() + 60_000);
    const second = (await (
      await app.request("/recipes", json({ ...tortilla, title: "Gazpacho" }, { cookie }))
    ).json()) as Recipe;
    vi.setSystemTime(Date.now() + 60_000);
    await app.request(`/recipes/${first.id}`, put({ ...tortilla, servings: "2" }, cookie));

    const listed = (await (await app.request("/recipes", { headers: { cookie } })).json()) as {
      recipes: { id: string }[];
    };

    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ recipes: [] });
    expect(listed.recipes.map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it("edits a recipe, and opening it again returns the edit with a later change time", async () => {
    const { app, recorder } = setup();
    const { userId, cookie } = await signedIn(app, recorder);
    vi.useFakeTimers({ toFake: ["Date"] });
    const added = (await (
      await app.request("/recipes", json(tortilla, { cookie }))
    ).json()) as Recipe;
    vi.setSystemTime(Date.now() + 60_000);

    const edited = await app.request(
      `/recipes/${added.id}`,
      put({ ...tortilla, servings: "6", steps: ["Todo junto."] }, cookie),
    );
    const saved = JSON.parse(await textWithoutCopyOwner(edited, userId)) as Recipe;
    const opened = (await (
      await app.request(`/recipes/${added.id}`, { headers: { cookie } })
    ).json()) as Recipe;

    expect(edited.status).toBe(200);
    expect(saved).toMatchObject({ id: added.id, servings: "6", steps: ["Todo junto."] });
    expect(opened).toEqual(saved);
    expect(Date.parse(opened.updatedAt)).toBeGreaterThan(Date.parse(added.updatedAt));
  });

  it("answers 400 Problem Details to a recipe with no steps, on POST and PUT", async () => {
    const { app, recorder } = setup();
    const { cookie } = await signedIn(app, recorder);
    const added = (await (
      await app.request("/recipes", json(tortilla, { cookie }))
    ).json()) as Recipe;

    const posted = await app.request("/recipes", json({ ...tortilla, steps: [] }, { cookie }));
    const replaced = await app.request(
      `/recipes/${added.id}`,
      put({ ...tortilla, steps: [] }, cookie),
    );

    for (const response of [posted, replaced]) {
      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    }
  });

  it("refuses a source that isn't an http or https link", async () => {
    const { app, recorder } = setup();
    const { cookie } = await signedIn(app, recorder);

    const response = await app.request(
      "/recipes",
      json({ ...tortilla, source: "javascript:alert(1)" }, { cookie }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 to an id that isn't a UUID", async () => {
    const { app, recorder } = setup();
    const { cookie } = await signedIn(app, recorder);

    const response = await app.request("/recipes/not-a-uuid", { headers: { cookie } });

    expect(response.status).toBe(400);
  });
});

describe("another user's recipe", () => {
  it("answers the same 404 as a recipe that doesn't exist, on GET and PUT, and stays unchanged", async () => {
    const { app, recorder } = setup();
    const ana = await signedIn(app, recorder);
    const bea = await signedIn(app, recorder);
    const anas = (await (
      await app.request("/recipes", json(tortilla, { cookie: ana.cookie }))
    ).json()) as Recipe;
    const nobodys = randomUUID();

    const answers = [];
    for (const id of [anas.id, nobodys]) {
      const got = await app.request(`/recipes/${id}`, { headers: { cookie: bea.cookie } });
      const replaced = await app.request(
        `/recipes/${id}`,
        put({ ...tortilla, title: "Robada" }, bea.cookie),
      );
      answers.push([got.status, await got.json(), replaced.status, await replaced.json()]);
    }
    const after = await app.request(`/recipes/${anas.id}`, { headers: { cookie: ana.cookie } });

    expect(answers[0]?.[0]).toBe(404);
    expect(answers[0]).toEqual(answers[1]);
    expect(await after.json()).toEqual(anas);
  });
});

describe("the session", () => {
  it("answers 401 on every recipes route without one, before checking the body or the id", async () => {
    const { app } = setup();
    const id = randomUUID();
    const requests: [string, RequestInit][] = [
      ["/recipes", {}],
      [`/recipes/${id}`, {}],
      ["/recipes", json(tortilla)],
      [`/recipes/${id}`, { ...json(tortilla), method: "PUT" }],
      ["/recipes", json({ ...tortilla, steps: [] })],
      ["/recipes/not-a-uuid", { ...json({}), method: "PUT" }],
    ];

    for (const [path, init] of requests) {
      const response = await app.request(path, init);
      expect(response.status, `${init.method ?? "GET"} ${path}`).toBe(401);
      expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    }
  });

  it("renews a remembered session through a recipes route, as through the login's", async () => {
    const { app, recorder } = setup();
    const { cookie } = await signedIn(app, recorder, true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const response = await app.request("/recipes", { headers: { cookie } });

    expect(response.status).toBe(200);
    expect(setCookies(response).get("better-auth.session_token")).toContain(
      `Max-Age=${NINETY_DAYS}`,
    );
  });
});

describe("where recipes exist", () => {
  it.each(["preview", "production"] as const)(
    "answers 404 for every recipes route in %s",
    async (env) => {
      const app = loginApp(postgres, recordingSender().sender, env);
      const id = randomUUID();

      for (const [method, path] of [
        ["GET", "/recipes"],
        ["POST", "/recipes"],
        ["GET", `/recipes/${id}`],
        ["PUT", `/recipes/${id}`],
      ]) {
        const response = await app.request(path ?? "", { method: method ?? "GET" });
        expect(response.status, `${method} ${path}`).toBe(404);
        expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
      }
    },
  );
});
