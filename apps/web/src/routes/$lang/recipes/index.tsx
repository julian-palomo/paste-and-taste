import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../../head.ts";
import { messagesFor, parseLanguage } from "../../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../../layout/keep-error-on-server.ts";
import { RecipeListView } from "../../../recipes/recipe-list-view.tsx";
import { getRecipeList } from "../../../recipes/recipes.functions.ts";
import { signInFor } from "../../../recipes/recipes.ts";

// Outside development, 404; signed out, the sign-in, then back here.
export const Route = createFileRoute("/$lang/recipes/")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  loader: async ({ params, location }) => {
    const { state, origin } = await getRecipeList();
    if (state.kind === "not-shown") throw notFound();
    if (state.kind === "signed-out")
      throw redirect({ href: signInFor(params.lang, location.pathname) });
    return { state, origin };
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "recipes") : {},
  component: RecipeListPage,
});

function RecipeListPage() {
  const { lang } = Route.useParams();
  const { state } = Route.useLoaderData();
  return <RecipeListView lang={lang} messages={messagesFor(lang)} state={state} />;
}
