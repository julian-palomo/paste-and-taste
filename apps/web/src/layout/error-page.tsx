import type { ErrorComponentProps } from "@tanstack/react-router";
import { messagesFor } from "../i18n/i18n.ts";
import { usePage } from "./page-context.ts";

// The router's defaultErrorComponent, shown inside the layout in place of the
// page that failed. It never reads the error: no message, no stack. "Try
// again" reloads the address, which works without JavaScript; the router's
// `reset` is undefined when the page is rendered on the server.
export function ErrorPage(_props: ErrorComponentProps) {
  const { lang, path } = usePage();
  const messages = messagesFor(lang);
  return (
    <section className="flex flex-col items-start gap-4">
      <h1>{messages.errorHeading}</h1>
      <p className="text-text-muted">{messages.errorBody}</p>
      <a
        href={path}
        className="rounded-control bg-accent px-4 py-2 text-on-accent transition hover:bg-text active:translate-y-px"
      >
        {messages.retry}
      </a>
    </section>
  );
}
