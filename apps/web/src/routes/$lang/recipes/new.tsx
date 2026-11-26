import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../../head.ts";
import { messagesFor, parseLanguage } from "../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../layout/keep-error-on-server.ts";
import { recipeErrorSearch } from "../../../recipes/recipe-form.ts";
import { RecipeFormView } from "../../../recipes/recipe-form-view.tsx";
import { RecipeUnavailable } from "../../../recipes/recipe-view.tsx";
import { getRecipeForm, saveRecipeForm } from "../../../recipes/recipes.functions.ts";
import { signInFor } from "../../../recipes/recipes.ts";

// A new recipe. ?error= and ?field= come from the page's address, after a
// form that came back. A signed-out visitor is sent to the sign-in on load;
// a session that ends while typing gets it on save, where the API answers
// 401, and the form comes back with what was typed.
export const Route = createFileRoute("/$lang/recipes/new")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  validateSearch: recipeErrorSearch,
  loader: async ({ params, location }) => {
    const page = await getRecipeForm({ data: { id: null } });
    if (page.kind !== "new") throw notFound();
    const { state } = page;
    if (state.kind === "not-shown") throw notFound();
    if (state.kind === "signed-out")
      throw redirect({ href: signInFor(params.lang, location.pathname) });
    return { state, draft: page.draft, origin: page.origin };
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "newRecipe") : {},
  component: NewRecipePage,
});

function NewRecipePage() {
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
      recipe={undefined}
      draft={draft}
      error={error}
    />
  );
}
