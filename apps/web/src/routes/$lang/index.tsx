import { createFileRoute, notFound } from "@tanstack/react-router";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";

export const Route = createFileRoute("/$lang/")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  head: ({ params }) => {
    const messages = messagesFor(params.lang);
    return {
      meta: [{ title: messages.title }, { name: "description", content: messages.description }],
    };
  },
  component: HealthPage,
});

function HealthPage() {
  const { lang } = Route.useParams();
  return <h1>{messagesFor(lang).heading}</h1>;
}
