import type { Recipe, RecipeInput, RecipeSummary } from "./recipe.ts";

// Where the recipes are kept, as the service needs them. The service depends
// only on this type: Postgres is one implementation, and the service's tests
// use another. Every operation is scoped to a copy owner, so another user's
// recipe is never read or written.
export type RecipesRepository = {
  // The copy owner's recipes, the newest change first.
  list(copyOwnerId: string): Promise<RecipeSummary[]>;
  // null when no recipe has this id and this copy owner.
  find(copyOwnerId: string, id: string): Promise<Recipe | null>;
  add(copyOwnerId: string, input: RecipeInput, now: Date): Promise<Recipe>;
  // null when no recipe has this id and this copy owner; nothing is written then.
  replace(copyOwnerId: string, id: string, input: RecipeInput, now: Date): Promise<Recipe | null>;
};
