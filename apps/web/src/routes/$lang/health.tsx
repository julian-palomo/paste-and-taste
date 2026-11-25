import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { getHealthPage } from "../../health/health.functions.ts";
import { HealthView } from "../../health/health-view.tsx";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../layout/keep-error-on-server.ts";

// The API's health, in every environment: the deploy's smoke reads it here
// (scripts/check-web.ts), whatever the home shows.
export const Route = createFileRoute("/$lang/health")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  loader: () => getHealthPage(),
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "health") : {},
  component: HealthPage,
});

function HealthPage() {
  const { lang } = Route.useParams();
  const { health } = Route.useLoaderData();
  return <HealthView state={health} messages={messagesFor(lang)} />;
}
