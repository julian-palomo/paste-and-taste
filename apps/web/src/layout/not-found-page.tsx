import { messagesFor } from "../i18n/i18n.ts";
import { usePage } from "./page-context.ts";

// The root route's notFoundComponent, shown inside the layout with status 404.
export function NotFoundPage() {
  const { lang } = usePage();
  const messages = messagesFor(lang);
  return (
    <section className="flex flex-col gap-4">
      <h1>{messages.notFoundHeading}</h1>
      <p className="text-text-muted">{messages.notFoundBody}</p>
      <p>
        <a
          href={`/${lang}`}
          className="text-accent underline underline-offset-4 transition-colors hover:text-text"
        >
          {messages.backHome}
        </a>
      </p>
    </section>
  );
}
