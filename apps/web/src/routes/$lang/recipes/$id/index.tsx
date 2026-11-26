import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../../../head.ts";
import { messagesFor, parseLanguage } from "../../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../../layout/keep-error-on-server.ts";
import { RecipeUnavailable, RecipeView } from "../../../../recipes/recipe-view.tsx";
import { getRecipe } from "../../../../recipes/recipes.functions.ts";
import { signInFor } from "../../../../recipes/recipes.ts";

// An unknown recipe and another user's are the same not-found page.
export const Route = createFileRoute("/$lang/recipes/$id/")({
  params: {
    parse: ({ lang, id }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language, id };
    },
  },
  loader: async ({ params, location }) => {
    const { state, origin } = await getRecipe({ data: { id: params.id } });
    if (state.kind === "not-shown" || state.kind === "not-found") throw notFound();
    if (state.kind === "signed-out")
      throw redirect({ href: signInFor(params.lang, location.pathname) });
    return { state, origin };
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) => {
    if (!loaderData) return {};
    const messages = messagesFor(params.lang);
    const { state } = loaderData;
    return pageHead(params.lang, loaderData.origin, {
      path: `/recipes/${params.id}`,
      title:
        state.kind === "ok" ? `${state.recipe.title} · ${messages.appName}` : messages.recipesTitle,
      description: messages.recipeDescription,
    });
  },
  component: RecipePage,
});

function RecipePage() {
  const { lang } = Route.useParams();
  const { state } = Route.useLoaderData();
  const messages = messagesFor(lang);
  return state.kind === "ok" ? (
    <RecipeView lang={lang} messages={messages} recipe={state.recipe} />
  ) : (
    <RecipeUnavailable messages={messages} kind={state.kind} />
  );
}
