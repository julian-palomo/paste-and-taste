import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../../../head.ts";
import { messagesFor, parseLanguage } from "../../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../../layout/keep-error-on-server.ts";
import { recipeErrorSearch } from "../../../../recipes/recipe-form.ts";
import { RecipeFormView } from "../../../../recipes/recipe-form-view.tsx";
import { RecipeUnavailable } from "../../../../recipes/recipe-view.tsx";
import { getRecipeForm, saveRecipeForm } from "../../../../recipes/recipes.functions.ts";
import { signInFor } from "../../../../recipes/recipes.ts";

// Editing a recipe: the form starts with it, or with what was typed before an
// error. An unknown recipe and another user's are the same not-found page.
export const Route = createFileRoute("/$lang/recipes/$id/edit")({
  params: {
    parse: ({ lang, id }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language, id };
    },
  },
  validateSearch: recipeErrorSearch,
  loader: async ({ params, location }) => {
    const page = await getRecipeForm({ data: { id: params.id } });
    if (page.kind !== "edit") throw notFound();
    const { state } = page;
    if (state.kind === "not-shown" || state.kind === "not-found") throw notFound();
    if (state.kind === "signed-out")
      throw redirect({ href: signInFor(params.lang, location.pathname) });
    return { state, draft: page.draft, origin: page.origin };
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) => {
    if (!loaderData) return {};
    const messages = messagesFor(params.lang);
    return pageHead(params.lang, loaderData.origin, {
      path: `/recipes/${params.id}/edit`,
      title: `${messages.editRecipeHeading} · ${messages.appName}`,
      description: messages.recipeDescription,
    });
  },
  component: EditRecipePage,
});

function EditRecipePage() {
  const { lang } = Route.useParams();
  const { state, draft } = Route.useLoaderData();
  const search = Route.useSearch();
  const error =
    search.error && search.field ? { kind: search.error, field: search.field } : undefined;
  const messages = messagesFor(lang);
  if (state.kind !== "ok") return <RecipeUnavailable messages={messages} kind={state.kind} />;
  return (
    <RecipeFormView
      lang={lang}
      messages={messages}
      action={saveRecipeForm.url}
      recipe={state.recipe}
      draft={draft}
      error={error}
    />
  );
}
