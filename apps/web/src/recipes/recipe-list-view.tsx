import type { Language, Messages } from "../i18n/i18n.ts";
import type { RecipeSummary } from "./recipes.ts";

type State =
  | { kind: "ok"; recipes: RecipeSummary[] }
  | { kind: "unreachable" }
  | { kind: "api-error" };

const link = "text-accent underline underline-offset-4 transition-colors hover:text-text";

// The user's recipes, the last change first, as the API orders them. <h1> and
// <p role="alert"> carry no class: tests match them exactly.
export function RecipeListView({
  lang,
  messages,
  state,
}: {
  lang: Language;
  messages: Messages;
  state: State;
}) {
  return (
    <section className="flex flex-col gap-6">
      <h1>{messages.recipesHeading}</h1>
      {state.kind === "ok" ? (
        <>
          <a href={`/${lang}/recipes/new`} className={`text-body ${link}`}>
            {messages.recipesAdd}
          </a>
          {state.recipes.length === 0 ? (
            <p className="text-body text-text-muted">{messages.recipesEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {state.recipes.map((recipe) => (
                <li key={recipe.id} lang={recipe.language}>
                  <a href={`/${lang}/recipes/${recipe.id}`} className={`text-body ${link}`}>
                    {recipe.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="text-body text-danger">
          <p role="alert">
            {state.kind === "unreachable" ? messages.recipesUnreachable : messages.recipesApiError}
          </p>
        </div>
      )}
    </section>
  );
}
