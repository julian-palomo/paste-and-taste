import type { Language, Messages } from "../i18n/i18n.ts";
import type { Recipe } from "./recipes.ts";

const link = "text-accent underline underline-offset-4 transition-colors hover:text-text";

// A recipe, calm and easy to read. Its own content carries its language,
// which may not be the interface's: a recipe stays in the language it was
// written in.
export function RecipeView({
  lang,
  messages,
  recipe,
}: {
  lang: Language;
  messages: Messages;
  recipe: Recipe;
}) {
  const content = recipe.language;
  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <a href={`/${lang}/recipes`} className={`text-small ${link}`}>
          {messages.recipesHeading}
        </a>
        <h1 lang={content}>{recipe.title}</h1>
        {(recipe.servings || recipe.time) && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-body">
            {recipe.servings && (
              <div className="flex flex-col">
                <dt className="text-small text-text-muted">{messages.recipeServings}</dt>
                <dd lang={content}>{recipe.servings}</dd>
              </div>
            )}
            {recipe.time && (
              <div className="flex flex-col">
                <dt className="text-small text-text-muted">{messages.recipeTime}</dt>
                <dd lang={content}>{recipe.time}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">{messages.recipeIngredients}</h2>
        <ul lang={content} className="flex list-disc flex-col gap-2 pl-6 text-body">
          {recipe.ingredients.map((ingredient, i) => (
            <li key={`${i}-${ingredient.name}`}>
              {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" ")}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">{messages.recipeSteps}</h2>
        <ol lang={content} className="flex list-decimal flex-col gap-3 pl-6 text-body">
          {recipe.steps.map((step, i) => (
            <li key={`${i}-${step.slice(0, 12)}`}>{step}</li>
          ))}
        </ol>
      </section>
      {recipe.source && (
        <p className="flex flex-col gap-1 text-body">
          <span className="text-small text-text-muted">{messages.recipeSource}</span>
          <a href={recipe.source} className={`break-all ${link}`}>
            {recipe.source}
          </a>
        </p>
      )}
      <a href={`/${lang}/recipes/${recipe.id}/edit`} className={`text-body ${link}`}>
        {messages.recipeEdit}
      </a>
      {/* Apart from editing, last on the page. A link only to the question:
          the delete itself is the confirmation's POST. */}
      <div className="border-t border-border pt-6">
        <a href={`/${lang}/recipes/${recipe.id}/delete`} className={`text-body ${link}`}>
          {messages.recipeDelete}
        </a>
      </div>
    </article>
  );
}

// A recipe page, or its edit form, when the API couldn't give the recipe.
export function RecipeUnavailable({
  messages,
  kind,
}: {
  messages: Messages;
  kind: "unreachable" | "api-error";
}) {
  return (
    <section className="flex flex-col gap-6">
      <h1>{messages.recipesHeading}</h1>
      <div className="text-body text-danger">
        <p role="alert">
          {kind === "unreachable" ? messages.recipesUnreachable : messages.recipesApiError}
        </p>
      </div>
    </section>
  );
}
