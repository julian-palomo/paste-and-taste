import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { getHealthPage } from "../../health/health.functions.ts";
import { HealthView } from "../../health/health-view.tsx";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";

export const Route = createFileRoute("/$lang/")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  loader: () => getHealthPage(),
  head: ({ params, loaderData }) => (loaderData ? pageHead(params.lang, loaderData.origin) : {}),
  component: HealthPage,
});

function HealthPage() {
  const { lang } = Route.useParams();
  const { health } = Route.useLoaderData();
  return <HealthView state={health} messages={messagesFor(lang)} />;
}
