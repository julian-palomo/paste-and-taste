import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { InvalidRequestError } from "../errors/invalid-request-error.ts";
import { ProblemDetails, problemResponses } from "../errors/problem-details.ts";
import type { CurrentUser } from "./current-user.ts";
import type { Recipe as RecipeData } from "./recipe.ts";
import type { RecipesService } from "./recipes.service.ts";

type RecipesDeps = { service: RecipesService; currentUser: CurrentUser };

// The signed-in user's id, put on the context by the session middleware.
type RecipesEnv = { Variables: { userId: string } };

// A BCP 47 tag: a language, then subtags such as a region or a script.
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

const Ingredient = z
  .object({
    name: z.string().min(1),
    quantity: z.string().nullable(),
    unit: z.string().nullable(),
  })
  .openapi("Ingredient");

const recipeFields = {
  title: z.string().min(1),
  language: z.string().regex(LANGUAGE_TAG),
  servings: z.string().nullable(),
  time: z.string().nullable(),
  ingredients: z.array(Ingredient).min(1),
  steps: z.array(z.string().min(1)).min(1),
  // Only http and https: the screen shows it as a link, and a javascript:
  // link would run when tapped.
  source: z.httpUrl().nullable(),
};

const RecipeInput = z.object(recipeFields).openapi("RecipeInput");
const Recipe = z
  .object({
    id: z.uuid(),
    ...recipeFields,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Recipe");
const RecipeSummary = z
  .object({ id: z.uuid(), title: z.string(), language: z.string() })
  .openapi("RecipeSummary");
const RecipeList = z.object({ recipes: z.array(RecipeSummary) }).openapi("RecipeList");
const RecipeId = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});

function problem(description: string) {
  return { description, content: { "application/problem+json": { schema: ProblemDetails } } };
}

const signedInOnly = {
  401: problem("There is no session."),
  503: problem("Login is not configured on this server."),
};

const listRecipes = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "The signed-in user's recipes, the newest change first.",
      content: { "application/json": { schema: RecipeList } },
    },
    ...signedInOnly,
    ...problemResponses,
  },
});

const getRecipe = createRoute({
  method: "get",
  path: "/{id}",
  request: { params: RecipeId },
  responses: {
    200: { description: "The whole recipe.", content: { "application/json": { schema: Recipe } } },
    400: problem("The id is not a UUID."),
    404: problem("No such recipe for this user."),
    ...signedInOnly,
    ...problemResponses,
  },
});

const addRecipe = createRoute({
  method: "post",
  path: "/",
  request: { body: { required: true, content: { "application/json": { schema: RecipeInput } } } },
  responses: {
    201: {
      description: "The recipe was added for the signed-in user.",
      content: { "application/json": { schema: Recipe } },
    },
    400: problem("The recipe doesn't match the schema."),
    ...signedInOnly,
    ...problemResponses,
  },
});

const replaceRecipe = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    params: RecipeId,
    body: { required: true, content: { "application/json": { schema: RecipeInput } } },
  },
  responses: {
    200: {
      description: "The recipe was replaced by the body.",
      content: { "application/json": { schema: Recipe } },
    },
    400: problem("The id is not a UUID, or the recipe doesn't match the schema."),
    404: problem("No such recipe for this user."),
    ...signedInOnly,
    ...problemResponses,
  },
});

function toBody(recipe: RecipeData) {
  return {
    id: recipe.id,
    title: recipe.title,
    language: recipe.language,
    servings: recipe.servings,
    time: recipe.time,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    source: recipe.source,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  };
}

export function recipesRoutes({ service, currentUser }: RecipesDeps): OpenAPIHono<RecipesEnv> {
  const app = new OpenAPIHono<RecipesEnv>({
    defaultHook: (result) => {
      if (!result.success) throw new InvalidRequestError("The request is not valid.");
    },
  });

  // Before every route and its validators: without a session the answer is
  // 401, whatever the body or the id. A renewed session's cookie goes out with
  // the response.
  app.use("*", async (c, next) => {
    const { user, setCookies } = await currentUser(c.req.raw);
    for (const cookie of setCookies) c.header("set-cookie", cookie, { append: true });
    c.set("userId", user.id);
    await next();
  });

  app.openapi(listRecipes, async (c) =>
    c.json({ recipes: await service.list(c.get("userId")) }, 200),
  );

  app.openapi(getRecipe, async (c) =>
    c.json(toBody(await service.get(c.get("userId"), c.req.valid("param").id)), 200),
  );

  app.openapi(addRecipe, async (c) =>
    c.json(toBody(await service.add(c.get("userId"), c.req.valid("json"))), 201),
  );

  app.openapi(replaceRecipe, async (c) =>
    c.json(
      toBody(await service.edit(c.get("userId"), c.req.valid("param").id, c.req.valid("json"))),
      200,
    ),
  );

  return app;
}
