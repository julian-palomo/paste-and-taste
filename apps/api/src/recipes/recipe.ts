// A recipe as the recipes module works with it. The copy owner is not here:
// it is who asks, passed beside the recipe, and never part of what is answered.

type Ingredient = { name: string; quantity: string | null; unit: string | null };

// What a client sends to add or replace a recipe.
export type RecipeInput = {
  title: string;
  // A BCP 47 tag: a recipe stays in the language it came in.
  language: string;
  // As the source states them, or null.
  servings: string | null;
  time: string | null;
  ingredients: Ingredient[];
  steps: string[];
  // The link it came from, or null.
  source: string | null;
};

export type Recipe = RecipeInput & { id: string; createdAt: Date; updatedAt: Date };

export type RecipeSummary = { id: string; title: string; language: string };
