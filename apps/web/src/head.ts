import { type Language, languages, messagesFor } from "./i18n/i18n.ts";

// A page's <head>: its title and description in its language, and an
// hreflang link to each language's address, plus "/" for anyone else. Search
// engines want those links absolute, so they are built from the origin.
export function pageHead(lang: Language, origin: string) {
  const messages = messagesFor(lang);
  return {
    meta: [{ title: messages.title }, { name: "description", content: messages.description }],
    links: [
      ...languages.map((language) => ({
        rel: "alternate",
        hrefLang: language,
        href: `${origin}/${language}`,
      })),
      { rel: "alternate", hrefLang: "x-default", href: `${origin}/` },
    ],
  };
}
