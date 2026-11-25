import { and, desc, eq } from "drizzle-orm";
import type { WithDatabase } from "../database/database.ts";
import { recipe } from "../database/schema.ts";
import type { Recipe } from "./recipe.ts";
import type { RecipesRepository } from "./recipes.repository.ts";

// The recipes in Postgres, through Drizzle. Each operation opens its own
// client through withDatabase, and the copy owner is in every `where`, so
// another user's row is never read or written.
export function createPostgresRecipesRepository(withDatabase: WithDatabase): RecipesRepository {
  const columns = {
    id: recipe.id,
    title: recipe.title,
    language: recipe.language,
    servings: recipe.servings,
    time: recipe.time,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    source: recipe.source,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };

  return {
    list: (copyOwnerId) =>
      withDatabase((db) =>
        db
          .select({ id: recipe.id, title: recipe.title, language: recipe.language })
          .from(recipe)
          .where(eq(recipe.copyOwnerId, copyOwnerId))
          .orderBy(desc(recipe.updatedAt), recipe.id),
      ),

    find: (copyOwnerId, id) =>
      withDatabase(async (db): Promise<Recipe | null> => {
        const [row] = await db
          .select(columns)
          .from(recipe)
          .where(and(eq(recipe.id, id), eq(recipe.copyOwnerId, copyOwnerId)));
        return row ?? null;
      }),

    add: (copyOwnerId, input, now) =>
      withDatabase(async (db) => {
        const [row] = await db
          .insert(recipe)
          .values({ ...input, copyOwnerId, createdAt: now, updatedAt: now })
          .returning(columns);
        if (!row) throw new Error("The recipe insert returned no row.");
        return row;
      }),

    replace: (copyOwnerId, id, input, now) =>
      withDatabase(async (db): Promise<Recipe | null> => {
        const [row] = await db
          .update(recipe)
          .set({ ...input, updatedAt: now })
          .where(and(eq(recipe.id, id), eq(recipe.copyOwnerId, copyOwnerId)))
          .returning(columns);
        return row ?? null;
      }),
  };
}
