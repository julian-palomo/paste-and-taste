import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../../head.ts";
import { messagesFor, parseLanguage } from "../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../layout/keep-error-on-server.ts";
import { parseRecipeError } from "../../../recipes/recipe-form.ts";
import { RecipeFormView } from "../../../recipes/recipe-form-view.tsx";
import { getRecipeForm, saveRecipeForm } from "../../../recipes/recipes.functions.ts";

// A new recipe. ?error= and ?field= come from the page's address, after a
// form that came back. Signing in is asked for on save, where the API answers
// 401, and the form comes back with what was typed.
export const Route = createFileRoute("/$lang/recipes/new")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  validateSearch: ({ error, field }: Record<string, unknown>) => ({
    error: parseRecipeError(error, field),
  }),
  loader: async () => {
    const page = await getRecipeForm({ data: { id: null } });
    if (page.kind !== "new") throw notFound();
    return page;
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "newRecipe") : {},
  component: NewRecipePage,
});

function NewRecipePage() {
  const { lang } = Route.useParams();
  const { draft } = Route.useLoaderData();
  const { error } = Route.useSearch();
  return (
    <RecipeFormView
      lang={lang}
      messages={messagesFor(lang)}
      action={saveRecipeForm.url}
      recipe={undefined}
      draft={draft}
      error={error}
    />
  );
}
