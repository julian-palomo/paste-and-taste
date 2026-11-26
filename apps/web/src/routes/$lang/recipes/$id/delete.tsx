import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../../../head.ts";
import { messagesFor, parseLanguage } from "../../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../../layout/keep-error-on-server.ts";
import { RecipeDeleteView } from "../../../../recipes/recipe-delete-view.tsx";
import { RecipeUnavailable } from "../../../../recipes/recipe-view.tsx";
import { deleteRecipeForm, getRecipe } from "../../../../recipes/recipes.functions.ts";
import { deleteErrorSearch, signInFor } from "../../../../recipes/recipes.ts";

// Asks before deleting a recipe. Loading it only reads the recipe; the delete
// is the form's POST. ?error= comes from the page's address, after a delete
// that failed.
export const Route = createFileRoute("/$lang/recipes/$id/delete")({
  params: {
    parse: ({ lang, id }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language, id };
    },
  },
  validateSearch: deleteErrorSearch,
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
    return pageHead(params.lang, loaderData.origin, {
      path: `/recipes/${params.id}/delete`,
      title: `${messages.recipeDelete} · ${messages.appName}`,
      description: messages.recipeDescription,
    });
  },
  component: DeleteRecipePage,
});

function DeleteRecipePage() {
  const { lang } = Route.useParams();
  const { state } = Route.useLoaderData();
  const { error } = Route.useSearch();
  const messages = messagesFor(lang);
  if (state.kind !== "ok") return <RecipeUnavailable messages={messages} kind={state.kind} />;
  return (
    <RecipeDeleteView
      lang={lang}
      messages={messages}
      action={deleteRecipeForm.url}
      recipe={state.recipe}
      error={error}
    />
  );
}
