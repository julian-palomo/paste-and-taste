import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import type { Recipe } from "./recipes.ts";

// Asks before a recipe is deleted, and works with no JavaScript: the one
// form posts to the delete's server function, and cancelling is a link back.
export function RecipeDeleteView({
  lang,
  messages,
  action,
  recipe,
  error,
}: {
  lang: Language;
  messages: Messages;
  action: string;
  recipe: Recipe;
  error: "unreachable" | "api-error" | undefined;
}) {
  return (
    <section className="flex flex-col gap-6">
      <h1>{messages.recipeDeleteHeading}</h1>
      <p lang={recipe.language} className="font-display text-xl font-bold">
        {recipe.title}
      </p>
      <p className="text-body">{messages.recipeDeleteWarning}</p>
      {error && (
        <div className="text-body text-danger">
          <p role="alert">
            {error === "unreachable"
              ? messages.recipeDeleteUnreachable
              : messages.recipeDeleteApiError}
          </p>
        </div>
      )}
      <form
        action={action}
        method="post"
        encType="multipart/form-data"
        className="flex flex-wrap items-center gap-4"
      >
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={recipe.id} />
        <Button kind="main" type="submit">
          {messages.recipeDelete}
        </Button>
        <a
          href={`/${lang}/recipes/${recipe.id}`}
          className="text-body text-accent underline underline-offset-4 transition-colors hover:text-text"
        >
          {messages.recipeDeleteCancel}
        </a>
      </form>
    </section>
  );
}
