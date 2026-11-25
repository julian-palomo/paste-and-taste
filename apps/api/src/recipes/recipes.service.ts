import type { Recipe, RecipeInput, RecipeSummary } from "./recipe.ts";
import { RecipeNotFoundError } from "./recipe-not-found-error.ts";
import type { RecipesRepository } from "./recipes.repository.ts";

// What the recipes routes need that isn't HTTP: a user's recipes, found or
// refused, and an edit saved with its time. `userId` is the signed-in user,
// who is the copy owner of every recipe they reach.
export type RecipesService = {
  list(userId: string): Promise<RecipeSummary[]>;
  get(userId: string, id: string): Promise<Recipe>;
  add(userId: string, input: RecipeInput): Promise<Recipe>;
  edit(userId: string, id: string, input: RecipeInput): Promise<Recipe>;
};

// The clock stamps when a recipe is created and changed; tests pass their own.
export function createRecipesService(
  repository: RecipesRepository,
  clock: () => Date = () => new Date(),
): RecipesService {
  return {
    list: (userId) => repository.list(userId),

    async get(userId, id) {
      const recipe = await repository.find(userId, id);
      if (!recipe) throw new RecipeNotFoundError();
      return recipe;
    },

    add: (userId, input) => repository.add(userId, input, clock()),

    async edit(userId, id, input) {
      const recipe = await repository.replace(userId, id, input, clock());
      if (!recipe) throw new RecipeNotFoundError();
      return recipe;
    },
  };
}
