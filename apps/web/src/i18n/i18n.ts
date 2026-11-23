import en from "./en.json";
import es from "./es.json";

export const languages = ["en", "es"] as const;
export type Language = (typeof languages)[number];

// English is the shape: a key missing from es.json fails typecheck here.
export type Messages = typeof en;
const messages: Record<Language, Messages> = { en, es };

// The language a visitor gets when their browser asks for neither.
const fallback: Language = "en";

export function parseLanguage(value: string): Language | undefined {
  return languages.find((language) => language === value);
}

export function messagesFor(language: Language): Messages {
  return messages[language];
}

// Reads an Accept-Language header ("es-ES,es;q=0.9,en;q=0.8") by weight and
// returns the first language the interface has.
export function pickLanguage(acceptLanguage: string | null): Language {
  const asked = (acceptLanguage ?? "")
    .split(",")
    .map((entry) => {
      const [tag = "", ...params] = entry.trim().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      return {
        primary: tag.split("-")[0]?.toLowerCase() ?? "",
        weight: q ? Number(q.slice(2)) : 1,
      };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight);
  for (const { primary } of asked) {
    const language = parseLanguage(primary);
    if (language) return language;
  }
  return fallback;
}
