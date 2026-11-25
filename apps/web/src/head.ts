import { type Language, languages, type Messages, messagesFor } from "./i18n/i18n.ts";

// Each page's address after the language, and the keys of its title and
// description.
const pages = {
  home: { path: "", title: "title", description: "description" },
  health: { path: "/health", title: "title", description: "description" },
  showcase: { path: "/showcase", title: "showcaseTitle", description: "showcaseDescription" },
  signIn: { path: "/sign-in", title: "signInTitle", description: "signInDescription" },
} as const satisfies Record<
  string,
  { path: string; title: keyof Messages; description: keyof Messages }
>;

// A page's <head>: its title and description in its language, and an
// hreflang link to its address in each language, plus a default for anyone
// else: "/" for the home, which sends each visitor to their language, and the
// English address for any other page. Search engines want those links
// absolute, so they are built from the origin.
export function pageHead(lang: Language, origin: string, page: keyof typeof pages) {
  const messages = messagesFor(lang);
  const { path, title, description } = pages[page];
  return {
    meta: [{ title: messages[title] }, { name: "description", content: messages[description] }],
    links: [
      ...languages.map((language) => ({
        rel: "alternate",
        hrefLang: language,
        href: `${origin}/${language}${path}`,
      })),
      {
        rel: "alternate",
        hrefLang: "x-default",
        href: path === "" ? `${origin}/` : `${origin}/en${path}`,
      },
    ],
  };
}
