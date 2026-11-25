import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../layout/keep-error-on-server.ts";
import { getShowcasePage } from "../../showcase/showcase.functions.ts";
import { ShowcaseView } from "../../showcase/showcase-view.tsx";

// Where the environment doesn't show it, the loader's notFound() makes it the
// root's not-found page, with status 404.
export const Route = createFileRoute("/$lang/showcase")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  loader: async () => {
    const page = await getShowcasePage();
    if (!page.shown) throw notFound();
    return page;
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "showcase") : {},
  component: ShowcasePage,
});

function ShowcasePage() {
  const { lang } = Route.useParams();
  return <ShowcaseView messages={messagesFor(lang)} />;
}
