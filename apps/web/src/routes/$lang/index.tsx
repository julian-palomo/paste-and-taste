import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { HealthView } from "../../health/health-view.tsx";
import { BuildingView } from "../../home/building-view.tsx";
import { getHomePage } from "../../home/home.functions.ts";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../layout/keep-error-on-server.ts";

// The home shows what homeOf picks for the environment: the API's health in
// development and preview, the building page in production.
export const Route = createFileRoute("/$lang/")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  loader: () => getHomePage(),
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData
      ? pageHead(
          params.lang,
          loaderData.origin,
          loaderData.kind === "building" ? "building" : "home",
        )
      : {},
  component: HomePage,
});

function HomePage() {
  const { lang } = Route.useParams();
  const page = Route.useLoaderData();
  const messages = messagesFor(lang);
  return page.kind === "building" ? (
    <BuildingView messages={messages} />
  ) : (
    <HealthView state={page.health} messages={messages} />
  );
}
