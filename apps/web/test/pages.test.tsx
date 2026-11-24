import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Language, messagesFor } from "../src/i18n/i18n.ts";
import { ErrorPage } from "../src/layout/error-page.tsx";
import { NotFoundPage } from "../src/layout/not-found-page.tsx";
import { PageContext } from "../src/layout/page-context.ts";

// A page as the router shows it: inside the layout's context, at `path`.
function render(lang: Language, path: string, page: ReactNode) {
  return renderToString(<PageContext value={{ lang, path }}>{page}</PageContext>);
}

describe.each(["en", "es"] as const)("in %s", (lang) => {
  const messages = messagesFor(lang);

  it("the not-found page says so and links home", () => {
    const html = render(lang, `/${lang}/nothing`, <NotFoundPage />);

    expect(html).toContain(`<h1>${messages.notFoundHeading}</h1>`);
    expect(html).toContain(messages.notFoundBody);
    expect(html).toMatch(new RegExp(`href="/${lang}"[^>]*>${messages.backHome}</a>`));
  });

  it("the error page says so, offers a retry, and shows nothing of the error", () => {
    const error = new Error("provoked failure 7f3a");
    const html = render(
      lang,
      `/${lang}/recipes`,
      <ErrorPage error={error} reset={() => {}} info={{ componentStack: "at Recipes" }} />,
    );

    expect(html).toContain(`<h1>${messages.errorHeading}</h1>`);
    expect(html).toContain(messages.errorBody);
    expect(html).toMatch(new RegExp(`href="/${lang}/recipes"[^>]*>${messages.retry}</a>`));
    expect(html).not.toMatch(/provoked failure|7f3a|at Recipes/);
  });
});
