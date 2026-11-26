import type { ReactNode } from "react";
import { type Language, messagesFor } from "../i18n/i18n.ts";
import { pathInLanguage } from "./language-path.ts";
import { PageContext } from "./page-context.ts";

// What every page shares: a header with the app's name and a link to the same
// page in the other language, and the page's own content in <main>. No footer
// until it has something to hold, such as the legal links at launch.
// The language link is a plain <a>, not the router's <Link>: it works without
// JavaScript, and a full page load on a language switch is fine.
export function Layout({
  lang,
  path,
  children,
}: {
  lang: Language;
  path: string;
  children: ReactNode;
}) {
  const messages = messagesFor(lang);
  // The interface has two languages: the link goes to the one not shown.
  const other: Language = lang === "en" ? "es" : "en";
  return (
    <PageContext value={{ lang, path }}>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <a href={`/${lang}`} className="font-display font-extrabold text-text">
              {messages.appName}
            </a>
            <a
              className="text-accent underline underline-offset-4 transition-colors hover:text-text"
              href={pathInLanguage(path, other)}
              hrefLang={other}
              lang={other}
            >
              {messages.otherLanguage}
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </div>
    </PageContext>
  );
}
