import { describe, expect, it } from "vitest";
import {
  checkRecipe,
  clearDraftCookies,
  draftCookies,
  parseRecipeError,
  type RecipeFormValues,
  readDraft,
  readRecipeForm,
  recipeErrorSearch,
  toRecipeInput,
} from "../src/recipes/recipe-form.ts";

// A form as the browser posts it: fields by name, rows by index.
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const filled = {
  title: "Tortilla de patatas",
  servings: "4",
  time: "40 min",
  source: "https://example.com/tortilla",
  "ingredient-order-0": "2",
  "ingredient-quantity-0": "4",
  "ingredient-unit-0": "",
  "ingredient-name-0": "huevos",
  "ingredient-order-1": "1",
  "ingredient-quantity-1": "500",
  "ingredient-unit-1": "g",
  "ingredient-name-1": "patatas",
  "ingredient-order-2": "3",
  "ingredient-quantity-2": "",
  "ingredient-unit-2": "",
  "ingredient-name-2": "",
  "step-order-0": "1",
  "step-text-0": "Pela y corta las patatas.",
  "step-order-1": "2",
  "step-text-1": "",
  "step-order-2": "3",
  "step-text-2": "Cuaja la tortilla.",
};

describe("readRecipeForm and toRecipeInput", () => {
  it("leaves out empty rows, orders rows by their number, and turns empty fields into null", () => {
    const values = readRecipeForm(form({ ...filled, servings: "", time: " " }));

    expect(toRecipeInput(values, "es")).toEqual({
      title: "Tortilla de patatas",
      language: "es",
      servings: null,
      time: null,
      source: "https://example.com/tortilla",
      ingredients: [
        { quantity: "500", unit: "g", name: "patatas" },
        { quantity: "4", unit: null, name: "huevos" },
      ],
      steps: ["Pela y corta las patatas.", "Cuaja la tortilla."],
    });
  });

  it("keeps the rows' own order when their numbers aren't numbers or repeat", () => {
    const values = readRecipeForm(
      form({
        ...filled,
        "ingredient-order-0": "x",
        "ingredient-order-1": "x",
        "step-order-0": "1",
        "step-order-2": "1",
      }),
    );
    const input = toRecipeInput(values, "en");

    expect(input.ingredients.map((i) => i.name)).toEqual(["huevos", "patatas"]);
    expect(input.steps).toEqual(["Pela y corta las patatas.", "Cuaja la tortilla."]);
    expect(input.language).toBe("en");
  });

  it("reads back the rows it was given, with what was typed in each", () => {
    const values = readRecipeForm(form(filled));

    expect(values.ingredients).toHaveLength(3);
    expect(values.ingredients[1]).toEqual({
      order: "1",
      quantity: "500",
      unit: "g",
      name: "patatas",
    });
    expect(values.steps[1]).toEqual({ order: "2", text: "" });
  });
});

// The API's own rules for a recipe (apps/api/src/recipes/recipes.routes.ts),
// checked before posting, so the first field with an error is known.
describe("checkRecipe", () => {
  const valid = readRecipeForm(form(filled));
  const with_ = (fields: Record<string, string>) => readRecipeForm(form({ ...filled, ...fields }));

  it("finds nothing wrong in a whole recipe", () => {
    expect(checkRecipe(valid)).toBeUndefined();
  });

  it.each([
    ["no title", { title: "  " }, "title", "title-missing"],
    ["a source on another protocol", { source: "ftp://example.com/x" }, "source", "source-invalid"],
    ["a source with no domain", { source: "https://localhost/x" }, "source", "source-invalid"],
    [
      "a source that is an IP address",
      { source: "https://127.0.0.1/x" },
      "source",
      "source-invalid",
    ],
    ["a source that isn't an address", { source: "tortilla" }, "source", "source-invalid"],
    [
      "an ingredient with a quantity but no name",
      { "ingredient-quantity-2": "1", "ingredient-name-2": "" },
      "ingredient-name-2",
      "ingredient-name-missing",
    ],
    [
      "no ingredient",
      {
        "ingredient-name-0": "",
        "ingredient-quantity-0": "",
        "ingredient-name-1": "",
        "ingredient-quantity-1": "",
        "ingredient-unit-1": "",
      },
      "ingredient-name-0",
      "ingredients-missing",
    ],
    ["no step", { "step-text-0": "", "step-text-2": "" }, "step-text-0", "steps-missing"],
  ])("with %s, the error is on %s", (_, fields, field, kind) => {
    expect(checkRecipe(with_(fields))).toEqual({ field, kind });
  });

  it("names the first field with an error, in the form's order", () => {
    expect(checkRecipe(with_({ title: "", "step-text-0": "", "step-text-2": "" }))).toEqual({
      field: "title",
      kind: "title-missing",
    });
  });

  it("takes an empty source as none", () => {
    expect(checkRecipe(with_({ source: "" }))).toBeUndefined();
  });
});

describe("the draft cookies", () => {
  const values: RecipeFormValues = readRecipeForm(form(filled));
  const header = (cookies: string[]) => cookies.map((c) => c.split(";")[0]).join("; ");

  it("are HttpOnly, SameSite=Lax, for the whole site, for 5 minutes, and Secure on HTTPS only", () => {
    for (const secure of [true, false]) {
      const [cookie = ""] = draftCookies(values, { secure }) ?? [];
      const attributes = cookie.split("; ");
      expect(cookie).toMatch(/^recipe_draft_0=/);
      expect(attributes).toEqual(
        expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=300"]),
      );
      expect(attributes.includes("Secure")).toBe(secure);
    }
  });

  it("give back what was typed, among other cookies", () => {
    const cookies = draftCookies(values, { secure: false }) ?? [];

    expect(readDraft(`session=abc; ${header(cookies)}; other=1`)).toEqual(values);
  });

  it("split a long recipe over several cookies of under 4000 bytes each", () => {
    const long = {
      ...values,
      steps: Array.from({ length: 12 }, (_, i) => ({
        order: String(i + 1),
        text: "x".repeat(400),
      })),
    };
    const cookies = draftCookies(long, { secure: true }) ?? [];

    expect(cookies.length).toBeGreaterThan(1);
    for (const cookie of cookies)
      expect(new TextEncoder().encode(cookie).length).toBeLessThan(4000);
    expect(readDraft(header(cookies))).toEqual(long);
  });

  it("keep nothing when the recipe needs more than 4 cookies", () => {
    const huge = {
      ...values,
      steps: Array.from({ length: 60 }, (_, i) => ({
        order: String(i + 1),
        text: "x".repeat(400),
      })),
    };

    expect(draftCookies(huge, { secure: false })).toBeUndefined();
  });

  it.each([
    ["no cookie header", undefined],
    ["no draft", "session=abc"],
    ["a broken draft", "recipe_draft_0=not-json"],
    ["a draft of another shape", `recipe_draft_0=${encodeURIComponent('{"title":1}')}`],
  ])("read %s as none", (_, cookieHeader) => {
    expect(readDraft(cookieHeader)).toBeUndefined();
  });

  it("are deleted, all four, by expired cookies of the same names and attributes", () => {
    const cleared = clearDraftCookies({ secure: true });

    expect(cleared.map((c) => c.split("=")[0])).toEqual([
      "recipe_draft_0",
      "recipe_draft_1",
      "recipe_draft_2",
      "recipe_draft_3",
    ]);
    for (const cookie of cleared) {
      expect(cookie.split("; ")).toEqual(expect.arrayContaining(["Max-Age=0", "Path=/", "Secure"]));
    }
  });
});

describe("parseRecipeError", () => {
  it.each([
    ["title-missing", "title"],
    ["ingredient-name-missing", "ingredient-name-3"],
    ["steps-missing", "step-text-0"],
  ])("reads %s on %s", (kind, field) => {
    expect(parseRecipeError(kind, field)).toEqual({ kind, field });
  });

  it.each([
    ["other", "title"],
    ["title-missing", "other"],
    ["title-missing", "ingredient-name-"],
    [undefined, "title"],
    ["title-missing", undefined],
  ])("reads %s on %s as none", (kind, field) => {
    expect(parseRecipeError(kind, field)).toBeUndefined();
  });
});

// The router rewrites an address whose validated search differs in shape from
// its query, which would drop ?field=: the form's search stays two strings.
describe("recipeErrorSearch", () => {
  it("keeps ?error= and ?field= as the two strings the address has", () => {
    expect(recipeErrorSearch({ error: "source-invalid", field: "source" })).toEqual({
      error: "source-invalid",
      field: "source",
    });
  });

  it("drops both when either isn't one the form knows", () => {
    expect(recipeErrorSearch({ error: "other", field: "source" })).toEqual({
      error: undefined,
      field: undefined,
    });
  });
});
