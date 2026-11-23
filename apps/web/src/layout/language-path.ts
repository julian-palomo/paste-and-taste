import { type Language, parseLanguage } from "../i18n/i18n.ts";

// The language an address is in: its first segment when that is a language,
// English otherwise, as on a not-found page for /nothing.
export function languageOfPath(pathname: string): Language {
  return parseLanguage(pathname.split("/")[1] ?? "") ?? "en";
}

// The same address in another language: /en/recipes/42 becomes
// /es/recipes/42. An address under no language goes to the language's home.
// The query and the hash are dropped.
export function pathInLanguage(pathname: string, language: Language): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!parseLanguage(first)) return `/${language}`;
  return ["", language, ...rest].join("/");
}
