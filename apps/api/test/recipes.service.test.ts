import { describe, expect, it } from "vitest";
import type { Recipe, RecipeInput } from "../src/recipes/recipe.ts";
import { RecipeNotFoundError } from "../src/recipes/recipe-not-found-error.ts";
import type { RecipesRepository } from "../src/recipes/recipes.repository.ts";
import { createRecipesService } from "../src/recipes/recipes.service.ts";

// A repository written for the test: the recipes in a map, with each copy
// owner beside them. No database and no HTTP.
function memoryRepository(): RecipesRepository {
  const rows = new Map<string, { copyOwnerId: string; recipe: Recipe }>();
  let next = 0;
  return {
    async list(copyOwnerId) {
      return [...rows.values()]
        .filter((row) => row.copyOwnerId === copyOwnerId)
        .map(({ recipe }) => ({ id: recipe.id, title: recipe.title, language: recipe.language }));
    },
    async find(copyOwnerId, id) {
      const row = rows.get(id);
      return row && row.copyOwnerId === copyOwnerId ? row.recipe : null;
    },
    async add(copyOwnerId, input, now) {
      next += 1;
      const recipe = { ...input, id: `recipe-${next}`, createdAt: now, updatedAt: now };
      rows.set(recipe.id, { copyOwnerId, recipe });
      return recipe;
    },
    async replace(copyOwnerId, id, input, now) {
      const row = rows.get(id);
      if (!row || row.copyOwnerId !== copyOwnerId) return null;
      const recipe = { ...input, id, createdAt: row.recipe.createdAt, updatedAt: now };
      rows.set(id, { copyOwnerId, recipe });
      return recipe;
    },
    async remove(copyOwnerId, id) {
      const row = rows.get(id);
      if (!row || row.copyOwnerId !== copyOwnerId) return false;
      return rows.delete(id);
    },
  };
}

// A clock the test moves by hand.
function clockAt(start: string) {
  let now = new Date(start);
  return {
    clock: () => now,
    moveTo: (time: string) => {
      now = new Date(time);
    },
  };
}

const tortilla: RecipeInput = {
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

describe("the recipes service", () => {
  it("adds a recipe stamped with the clock, then lists and returns it", async () => {
    const { clock } = clockAt("2026-11-25T10:00:00Z");
    const service = createRecipesService(memoryRepository(), clock);

    const added = await service.add("ana", tortilla);

    expect(added).toEqual({
      ...tortilla,
      id: expect.any(String),
      createdAt: new Date("2026-11-25T10:00:00Z"),
      updatedAt: new Date("2026-11-25T10:00:00Z"),
    });
    expect(await service.list("ana")).toEqual([
      { id: added.id, title: "Tortilla de patatas", language: "es" },
    ]);
    expect(await service.get("ana", added.id)).toEqual(added);
  });

  it("edits a recipe: the fields replaced, created kept, changed moved on", async () => {
    const { clock, moveTo } = clockAt("2026-11-25T10:00:00Z");
    const service = createRecipesService(memoryRepository(), clock);
    const added = await service.add("ana", tortilla);
    moveTo("2026-11-26T09:00:00Z");

    const edited = await service.edit("ana", added.id, { ...tortilla, servings: "6" });

    expect(edited.servings).toBe("6");
    expect(edited.createdAt).toEqual(new Date("2026-11-25T10:00:00Z"));
    expect(edited.updatedAt).toEqual(new Date("2026-11-26T09:00:00Z"));
    expect(await service.get("ana", added.id)).toEqual(edited);
  });

  it("finds no recipe for an id that doesn't exist", async () => {
    const service = createRecipesService(memoryRepository());

    await expect(service.get("ana", "no-such-id")).rejects.toBeInstanceOf(RecipeNotFoundError);
    await expect(service.edit("ana", "no-such-id", tortilla)).rejects.toBeInstanceOf(
      RecipeNotFoundError,
    );
  });

  it("finds no recipe of another copy owner, and leaves it unchanged", async () => {
    const service = createRecipesService(memoryRepository());
    const anas = await service.add("ana", tortilla);

    await expect(service.get("bea", anas.id)).rejects.toBeInstanceOf(RecipeNotFoundError);
    await expect(
      service.edit("bea", anas.id, { ...tortilla, title: "Otra cosa" }),
    ).rejects.toBeInstanceOf(RecipeNotFoundError);
    expect(await service.get("ana", anas.id)).toEqual(anas);
    expect(await service.list("bea")).toEqual([]);
  });
});
