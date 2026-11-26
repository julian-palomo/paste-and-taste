import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Language, messagesFor } from "../src/i18n/i18n.ts";
import { readRecipeForm } from "../src/recipes/recipe-form.ts";
import { RecipeFormView } from "../src/recipes/recipe-form-view.tsx";
import { RecipeListView } from "../src/recipes/recipe-list-view.tsx";
import { RecipeView } from "../src/recipes/recipe-view.tsx";

const ID = "7c0c1f9e-2d0a-4e5b-9f1a-0b2c3d4e5f60";
const recipe = {
  id: ID,
  title: "Tortilla de patatas",
  language: "es",
  servings: "4",
  time: "40 min",
  ingredients: [
    { quantity: "500", unit: "g", name: "patatas" },
    { quantity: "4", unit: null, name: "huevos" },
  ],
  steps: ["Pela y corta las patatas.", "Cuaja la tortilla."],
  source: "https://example.com/tortilla",
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: "2026-11-25T11:00:00.000Z",
};

// Text as renderToString writes it.
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
const inputs = (html: string) => [...html.matchAll(/<(input|textarea)[^>]*>/g)].map(([tag]) => tag);
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textOf = (html: string, id: string) =>
  new RegExp(`id="${escapeRegExp(id)}"[^>]*>([^<]*)<`).exec(html)?.[1];

describe.each(["en", "es"] as const)("in %s", (lang: Language) => {
  const m = messagesFor(lang);

  describe("the list", () => {
    it("links each recipe by its title, in the order given, and offers to add one", () => {
      const html = renderToString(
        <RecipeListView
          lang={lang}
          messages={m}
          state={{
            kind: "ok",
            recipes: [
              { id: "b", title: "Gazpacho", language: "es" },
              { id: "a", title: "Tortilla", language: "es" },
            ],
          }}
        />,
      );

      expect(html).toContain(`<h1>${escaped(m.recipesHeading)}</h1>`);
      expect(html).toMatch(
        new RegExp(
          `href="/${lang}/recipes/b"[^>]*>Gazpacho<.*href="/${lang}/recipes/a"[^>]*>Tortilla<`,
        ),
      );
      expect(html).toMatch(
        new RegExp(`href="/${lang}/recipes/new"[^>]*>${escaped(m.recipesAdd)}<`),
      );
      expect(html).not.toContain(escaped(m.recipesEmpty));
    });

    it("when empty, says so and leads to adding the first one", () => {
      const html = renderToString(
        <RecipeListView lang={lang} messages={m} state={{ kind: "ok", recipes: [] }} />,
      );

      expect(html).toContain(escaped(m.recipesEmpty));
      expect(html).toMatch(new RegExp(`href="/${lang}/recipes/new"`));
    });

    it.each([
      ["unreachable", "recipesUnreachable"],
      ["api-error", "recipesApiError"],
    ] as const)("when the API is %s, says so in its own words", (kind, key) => {
      const html = renderToString(<RecipeListView lang={lang} messages={m} state={{ kind }} />);

      expect(html).toContain(`<p role="alert">${escaped(m[key])}</p>`);
    });
  });

  describe("a recipe", () => {
    const html = renderToString(<RecipeView lang={lang} messages={m} recipe={recipe} />);

    it("shows its title, servings and time, ingredients and numbered steps", () => {
      expect(html).toMatch(/<h1[^>]*lang="es"[^>]*>Tortilla de patatas<\/h1>/);
      expect(html).toContain("4");
      expect(html).toContain("40 min");
      expect(html).toMatch(/500 g patatas/);
      expect(html).toMatch(/4 huevos/);
      expect(html).toMatch(
        /<ol[^>]*lang="es"[^>]*><li[^>]*>Pela y corta las patatas\.<\/li><li[^>]*>Cuaja la tortilla\.<\/li><\/ol>/,
      );
    });

    it("links its source, and its edit form", () => {
      expect(html).toMatch(/href="https:\/\/example\.com\/tortilla"/);
      expect(html).toMatch(
        new RegExp(`href="/${lang}/recipes/${ID}/edit"[^>]*>${escaped(m.recipeEdit)}<`),
      );
    });

    // The recipe keeps the language it was written in, whatever the interface's.
    it("marks its own content with the recipe's language", () => {
      const html = renderToString(
        <RecipeView lang={lang} messages={m} recipe={{ ...recipe, language: "it" }} />,
      );
      expect(html).toMatch(/<h1[^>]*lang="it"/);
      expect(html).toMatch(/<ul[^>]*lang="it"/);
      expect(html).toMatch(/<ol[^>]*lang="it"/);
    });

    it("leaves out servings, time and source when it has none", () => {
      const bare = renderToString(
        <RecipeView
          lang={lang}
          messages={m}
          recipe={{ ...recipe, servings: null, time: null, source: null }}
        />,
      );
      expect(bare).not.toContain(escaped(m.recipeServings));
      expect(bare).not.toContain(escaped(m.recipeTime));
      expect(bare).not.toContain("https://example.com");
    });
  });

  describe("the form", () => {
    const render = (props: Partial<Parameters<typeof RecipeFormView>[0]> = {}) =>
      renderToString(
        <RecipeFormView
          lang={lang}
          messages={m}
          action="/_serverFn/save"
          recipe={undefined}
          draft={undefined}
          error={undefined}
          {...props}
        />,
      );
    const names = (html: string) => inputs(html).map((tag) => attribute(tag, "name"));

    it("for a new recipe, starts empty with 8 ingredient rows and 5 step rows", () => {
      const html = render();
      const fields = names(html);

      expect(fields.filter((n) => n?.startsWith("ingredient-name-"))).toHaveLength(8);
      expect(fields.filter((n) => n?.startsWith("step-text-"))).toHaveLength(5);
      expect(fields).not.toContain("id");
      expect(fields).not.toContain("language");
      expect(html).toMatch(/<form[^>]*action="\/_serverFn\/save"[^>]*method="post"/);
      expect(html).not.toContain("autofocus");
    });

    it("to edit, starts with the recipe, its rows and 3 and 2 more", () => {
      const html = render({ recipe });
      const tags = inputs(html);
      const value = (name: string) =>
        attribute(tags.find((tag) => attribute(tag, "name") === name) ?? "", "value");

      expect(value("title")).toBe("Tortilla de patatas");
      expect(value("ingredient-name-1")).toBe("huevos");
      expect(value("ingredient-order-1")).toBe("2");
      expect(names(html).filter((n) => n?.startsWith("ingredient-name-"))).toHaveLength(5);
      expect(names(html).filter((n) => n?.startsWith("step-text-"))).toHaveLength(4);
      expect(html).toContain("Cuaja la tortilla.");
      expect(value("id")).toBe(ID);
      // The recipe's own language goes back with it, not the page's.
      expect(value("language")).toBe("es");
    });

    it("shows a refused field's text on it alone, with the focus, and keeps what was typed", () => {
      const draft = readRecipeForm(
        (() => {
          const data = new FormData();
          data.set("title", "Tortilla");
          data.set("source", "localhost");
          data.set("ingredient-name-0", "patatas");
          data.set("step-text-0", "Pela.");
          return data;
        })(),
      );
      const html = render({ draft, error: { kind: "source-invalid", field: "source" } });
      const focused = inputs(html).filter((tag) => /\sautofocus=""/.test(tag));

      expect(focused).toHaveLength(1);
      const [tag = ""] = focused;
      expect(attribute(tag, "name")).toBe("source");
      expect(attribute(tag, "aria-invalid")).toBe("true");
      expect(attribute(tag, "value")).toBe("localhost");
      const described = attribute(tag, "aria-describedby")?.split(" ") ?? [];
      expect(described.map((id) => textOf(html, id))).toContain(
        escaped(m.recipeErrorSourceInvalid),
      );
      expect(html).not.toContain(escaped(m.recipeDraftLost));
    });

    it("ties a step's error to its text area, which has the focus", () => {
      const html = render({ error: { kind: "steps-missing", field: "step-text-0" } });
      const focused = inputs(html).filter((tag) => /\sautofocus=""/.test(tag));

      expect(focused).toHaveLength(1);
      const [tag = ""] = focused;
      expect(tag).toMatch(/^<textarea/);
      expect(attribute(tag, "name")).toBe("step-text-0");
      const described = attribute(tag, "aria-describedby")?.split(" ") ?? [];
      expect(described.map((id) => textOf(html, id))).toContain(escaped(m.recipeErrorStepsMissing));
    });

    it("says what was typed couldn't be kept when an error comes with no draft", () => {
      const html = render({ error: { kind: "unreachable", field: "title" } });

      expect(html).toContain(escaped(m.recipeErrorUnreachable));
      expect(html).toContain(escaped(m.recipeDraftLost));
    });

    it("takes every value from the tokens", () => {
      const html = render({ recipe, error: { kind: "title-missing", field: "title" } });
      const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list = ""]) =>
        list.split(/\s+/),
      );
      expect(classes.filter((name) => /[[(]/.test(name))).toEqual([]);
      expect(html).not.toContain("style=");
    });
  });
});
