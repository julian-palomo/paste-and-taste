import { createApiClient } from "@paste-and-taste/api-client";
import { describe, expect, it } from "vitest";
import { readDraft, readRecipeForm } from "../src/recipes/recipe-form.ts";
import { listRecipes, type RecipesDeps, readRecipe, saveRecipe } from "../src/recipes/recipes.ts";
import { recipesShown } from "../src/recipes/recipes-shown.ts";

const browser = {
  cookie: "better-auth.session_token=abc",
  "cf-connecting-ip": "203.0.113.7",
  "user-agent": "Test browser",
};
// Two cookies with their attributes, as the API's Set-Cookie writes them: a
// session renewed on a read.
const first = "better-auth.session_token=new; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000";
const second = "better-auth.session_data=xyz; Path=/; HttpOnly; SameSite=Lax";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });
const problem = (status: number) =>
  json({ type: "about:blank", title: "Error", status, detail: "Detail." }, status);
const withCookies = (response: Response) => {
  response.headers.append("Set-Cookie", first);
  response.headers.append("Set-Cookie", second);
  return response;
};

const ID = "7c0c1f9e-2d0a-4e5b-9f1a-0b2c3d4e5f60";
const recipe = {
  id: ID,
  title: "Tortilla de patatas",
  language: "es",
  servings: "4",
  time: null,
  ingredients: [{ quantity: "500", unit: "g", name: "patatas" }],
  steps: ["Pela y corta las patatas."],
  source: null,
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: "2026-11-25T11:00:00.000Z",
};

function api(answer: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const setCookies: string[] = [];
  const deps: RecipesDeps = {
    client: createApiClient({
      baseUrl: "http://api.test",
      fetch: async (request) => {
        requests.push(request);
        return answer(request);
      },
    }),
    headers: browser,
    appendSetCookie: (cookie) => setCookies.push(cookie),
    shown: true,
    origin: "http://localhost:5173",
  };
  return { deps, requests, setCookies };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return readRecipeForm(data);
};
const values = form({
  title: "Tortilla de patatas",
  servings: "4",
  time: "",
  source: "",
  "ingredient-order-0": "1",
  "ingredient-quantity-0": "500",
  "ingredient-unit-0": "g",
  "ingredient-name-0": "patatas",
  "step-order-0": "1",
  "step-text-0": "Pela y corta las patatas.",
});
const body = {
  title: "Tortilla de patatas",
  language: "es",
  servings: "4",
  time: null,
  source: null,
  ingredients: [{ quantity: "500", unit: "g", name: "patatas" }],
  steps: ["Pela y corta las patatas."],
};

// Each function that calls the API, with what the API answers it on success.
const calls = [
  ["listRecipes", () => json({ recipes: [] }), (d: RecipesDeps) => listRecipes(d)],
  ["readRecipe", () => json(recipe), (d: RecipesDeps) => readRecipe(d, ID)],
  [
    "saveRecipe, new",
    () => json(recipe, 201),
    (d: RecipesDeps) => saveRecipe(d, { lang: "es", values }),
  ],
  [
    "saveRecipe, edit",
    () => json(recipe),
    (d: RecipesDeps) => saveRecipe(d, { lang: "es", id: ID, values }),
  ],
] as const;

describe.each(calls)("%s", (_, answer, call) => {
  it("sends the browser's cookie, IP and user agent to the API", async () => {
    const { deps, requests } = api(answer);

    await call(deps);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("cookie")).toBe(browser.cookie);
    expect(requests[0]?.headers.get("cf-connecting-ip")).toBe(browser["cf-connecting-ip"]);
    expect(requests[0]?.headers.get("user-agent")).toBe(browser["user-agent"]);
  });

  it("hands a renewed session's cookies back to the browser, unchanged and in order", async () => {
    const { deps, setCookies } = api(() => withCookies(answer()));

    await call(deps);

    expect(setCookies.slice(0, 2)).toEqual([first, second]);
  });

  it("calls nothing where recipes aren't shown", async () => {
    const { deps, requests } = api(answer);

    const result = await call({ ...deps, shown: false });

    expect(requests).toHaveLength(0);
    expect(result).toEqual(_.startsWith("saveRecipe") ? { notFound: true } : { kind: "not-shown" });
  });
});

describe("listRecipes", () => {
  it("is the user's recipes, in the API's order", async () => {
    const recipes = [
      { id: "b", title: "Gazpacho", language: "es" },
      { id: "a", title: "Tortilla", language: "es" },
    ];
    const { deps } = api(() => json({ recipes }));

    expect(await listRecipes(deps)).toEqual({ kind: "ok", recipes });
  });

  it.each([
    [401, "signed-out"],
    [503, "api-error"],
    [500, "api-error"],
  ])("on a %i, is %s", async (status, kind) => {
    const { deps } = api(() => problem(status));

    expect(await listRecipes(deps)).toEqual({ kind });
  });

  it("is unreachable when the API can't be reached", async () => {
    const { deps } = api(() => {
      throw new TypeError("fetch failed");
    });

    expect(await listRecipes(deps)).toEqual({ kind: "unreachable" });
  });
});

describe("readRecipe", () => {
  it("is the recipe", async () => {
    const { deps, requests } = api(() => json(recipe));

    expect(await readRecipe(deps, ID)).toEqual({ kind: "ok", recipe });
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(`/recipes/${ID}`);
  });

  // Unknown, another user's, or not even an id: the same not-found page.
  it.each([404, 400])("on a %i, is not found", async (status) => {
    const { deps } = api(() => problem(status));

    expect(await readRecipe(deps, ID)).toEqual({ kind: "not-found" });
  });

  it("on a 401, is signed out", async () => {
    const { deps } = api(() => problem(401));

    expect(await readRecipe(deps, ID)).toEqual({ kind: "signed-out" });
  });
});

describe("saveRecipe", () => {
  it("posts a new recipe in the page's language and goes to its page", async () => {
    const { deps, requests, setCookies } = api(() => json({ ...recipe, id: "new-id" }, 201));

    const result = await saveRecipe(deps, { lang: "es", values });

    expect(requests[0]?.method).toBe("POST");
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/recipes");
    expect(await requests[0]?.json()).toEqual(body);
    expect(result).toEqual({ redirect: "/es/recipes/new-id" });
    // The draft, if any, is gone once saved.
    expect(setCookies.some((c) => c.startsWith("recipe_draft_0=;"))).toBe(true);
  });

  it("puts an edited recipe and goes back to its page", async () => {
    const { deps, requests } = api(() => json(recipe));

    const result = await saveRecipe(deps, { lang: "en", id: ID, values });

    expect(requests[0]?.method).toBe("PUT");
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(`/recipes/${ID}`);
    expect(await requests[0]?.json()).toEqual({ ...body, language: "en" });
    expect(result).toEqual({ redirect: `/en/recipes/${ID}` });
  });

  it("keeps a refused field's error and what was typed, without calling the API", async () => {
    const { deps, requests, setCookies } = api(() => json(recipe, 201));
    const noTitle = { ...values, title: "" };

    const result = await saveRecipe(deps, { lang: "es", values: noTitle });

    expect(requests).toHaveLength(0);
    expect(result).toEqual({ redirect: "/es/recipes/new?error=title-missing&field=title" });
    const header = setCookies.map((c) => c.split(";")[0]).join("; ");
    expect(readDraft(header)).toEqual(noTitle);
  });

  it("sends a signed-out visitor to the sign-in, and back to the form after", async () => {
    const { deps } = api(() => problem(401));

    expect(await saveRecipe(deps, { lang: "es", id: ID, values })).toEqual({
      redirect: `/es/sign-in?next=${encodeURIComponent(`/es/recipes/${ID}/edit`)}`,
    });
  });

  it.each([404, 400])(
    "editing a recipe that is gone or another user's (%i) shows its page, not found",
    async (status) => {
      const { deps } = api(() => problem(status));

      expect(await saveRecipe(deps, { lang: "es", id: ID, values })).toEqual({
        redirect: `/es/recipes/${ID}`,
      });
    },
  );

  it.each([
    [400, "refused"],
    [503, "api-error"],
  ])("a new recipe refused with a %i goes back to the form with %s", async (status, kind) => {
    const { deps } = api(() => problem(status));

    expect(await saveRecipe(deps, { lang: "es", values })).toEqual({
      redirect: `/es/recipes/new?error=${kind}&field=title`,
    });
  });

  it("goes back to the form when the API can't be reached", async () => {
    const { deps } = api(() => {
      throw new TypeError("fetch failed");
    });

    expect(await saveRecipe(deps, { lang: "es", values })).toEqual({
      redirect: "/es/recipes/new?error=unreachable&field=title",
    });
  });
});

describe("recipesShown", () => {
  it.each([
    ["development", true],
    ["preview", false],
    ["production", false],
  ] as const)("in %s is %s", (environment, shown) => {
    expect(recipesShown(environment)).toBe(shown);
  });
});
