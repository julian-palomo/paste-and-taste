import { useId } from "react";
import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { TextField } from "../pieces/text-field.tsx";
import type { RecipeErrorKind, RecipeFormValues } from "./recipe-form.ts";
import type { Recipe } from "./recipes.ts";

// One form for a new recipe and an edited one, which works with no JavaScript:
// posted to a server function, it comes back here with an error and what was
// typed (the draft). Rows are added by filling a spare row, removed by
// clearing one, and reordered by their Orden number.

type FormError = { kind: RecipeErrorKind; field: string };

// Spare rows: a new recipe gets enough for an ordinary one, an edited recipe
// a few more than it has.
const NEW_INGREDIENT_ROWS = 8;
const NEW_STEP_ROWS = 5;
const SPARE_INGREDIENT_ROWS = 3;
const SPARE_STEP_ROWS = 2;

const emptyIngredients = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    order: String(from + i + 1),
    quantity: "",
    unit: "",
    name: "",
  }));
const emptySteps = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ order: String(from + i + 1), text: "" }));

function startingValues(recipe: Recipe | undefined): RecipeFormValues {
  if (!recipe) {
    return {
      title: "",
      servings: "",
      time: "",
      source: "",
      ingredients: emptyIngredients(0, NEW_INGREDIENT_ROWS),
      steps: emptySteps(0, NEW_STEP_ROWS),
    };
  }
  return {
    title: recipe.title,
    servings: recipe.servings ?? "",
    time: recipe.time ?? "",
    source: recipe.source ?? "",
    ingredients: [
      ...recipe.ingredients.map((ingredient, i) => ({
        order: String(i + 1),
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? "",
        name: ingredient.name,
      })),
      ...emptyIngredients(recipe.ingredients.length, SPARE_INGREDIENT_ROWS),
    ],
    steps: [
      ...recipe.steps.map((text, i) => ({ order: String(i + 1), text })),
      ...emptySteps(recipe.steps.length, SPARE_STEP_ROWS),
    ],
  };
}

function errorText(messages: Messages, kind: RecipeErrorKind): string {
  return {
    "title-missing": messages.recipeErrorTitleMissing,
    "source-invalid": messages.recipeErrorSourceInvalid,
    "ingredient-name-missing": messages.recipeErrorIngredientNameMissing,
    "ingredients-missing": messages.recipeErrorIngredientsMissing,
    "steps-missing": messages.recipeErrorStepsMissing,
    refused: messages.recipeErrorRefused,
    unreachable: messages.recipeErrorUnreachable,
    "api-error": messages.recipeErrorApiError,
  }[kind];
}

// A step's text: a text area, which no shared piece has yet; the same
// label, hint and error tie as TextField.
function StepText({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  error: string | undefined;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="font-bold text-body">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        // biome-ignore lint/a11y/noAutofocus: only a field with an error is given the focus, after its form was sent, so a screen reader reads the field with its error.
        autoFocus={error !== undefined}
        className="w-full rounded-card border-2 border-border-control bg-surface-raised px-5 py-3 text-body text-text aria-invalid:border-danger"
      />
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function RecipeFormView({
  lang,
  messages,
  action,
  recipe,
  draft,
  error,
}: {
  lang: Language;
  messages: Messages;
  action: string;
  recipe: Recipe | undefined;
  draft: RecipeFormValues | undefined;
  error: FormError | undefined;
}) {
  const values = draft ?? startingValues(recipe);
  // The field the error is on gets its text and the focus; no other does.
  const on = (name: string) =>
    error?.field === name ? errorText(messages, error.kind) : undefined;
  const focus = (name: string) => error?.field === name;
  const cancel = recipe ? `/${lang}/recipes/${recipe.id}` : `/${lang}/recipes`;

  return (
    <section className="flex flex-col gap-8">
      <h1>{recipe ? messages.editRecipeHeading : messages.newRecipeHeading}</h1>
      {error && !draft && <p className="text-body text-text-muted">{messages.recipeDraftLost}</p>}
      <form
        action={action}
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-8"
      >
        <input type="hidden" name="lang" value={lang} />
        {recipe && <input type="hidden" name="id" value={recipe.id} />}
        {/* An edited recipe keeps its own language, which may not be the page's. */}
        {recipe && <input type="hidden" name="language" value={recipe.language} />}
        <div className="flex flex-col gap-4">
          <TextField
            label={messages.recipeFormTitle}
            name="title"
            type="text"
            defaultValue={values.title}
            error={on("title")}
            autoFocus={focus("title")}
          />
          <TextField
            label={messages.recipeFormServings}
            name="servings"
            type="text"
            defaultValue={values.servings}
            error={on("servings")}
            autoFocus={focus("servings")}
          />
          <TextField
            label={messages.recipeFormTime}
            name="time"
            type="text"
            hint={messages.recipeFormTimeHint}
            defaultValue={values.time}
            error={on("time")}
            autoFocus={focus("time")}
          />
          <TextField
            label={messages.recipeFormSource}
            name="source"
            type="text"
            hint={messages.recipeFormSourceHint}
            defaultValue={values.source}
            error={on("source")}
            autoFocus={focus("source")}
          />
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">{messages.recipeFormIngredients}</h2>
          <p className="text-small text-text-muted">{messages.recipeFormIngredientsHint}</p>
          {values.ingredients.map((row, i) => (
            <fieldset
              key={`ingredient-${i}`}
              className="flex flex-col gap-3 border-b border-border pb-4"
            >
              <legend className="font-bold text-body">{`${messages.recipeFormIngredient} ${i + 1}`}</legend>
              <TextField
                label={messages.recipeFormOrder}
                name={`ingredient-order-${i}`}
                type="text"
                inputMode="numeric"
                defaultValue={row.order}
              />
              <TextField
                label={messages.recipeFormQuantity}
                name={`ingredient-quantity-${i}`}
                type="text"
                defaultValue={row.quantity}
              />
              <TextField
                label={messages.recipeFormUnit}
                name={`ingredient-unit-${i}`}
                type="text"
                defaultValue={row.unit}
              />
              <TextField
                label={messages.recipeFormName}
                name={`ingredient-name-${i}`}
                type="text"
                defaultValue={row.name}
                error={on(`ingredient-name-${i}`)}
                autoFocus={focus(`ingredient-name-${i}`)}
              />
            </fieldset>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">{messages.recipeFormSteps}</h2>
          <p className="text-small text-text-muted">{messages.recipeFormStepsHint}</p>
          {values.steps.map((row, i) => (
            <fieldset key={`step-${i}`} className="flex flex-col gap-3 border-b border-border pb-4">
              <legend className="font-bold text-body">{`${messages.recipeFormStep} ${i + 1}`}</legend>
              <TextField
                label={messages.recipeFormOrder}
                name={`step-order-${i}`}
                type="text"
                inputMode="numeric"
                defaultValue={row.order}
              />
              <StepText
                label={messages.recipeFormStep}
                name={`step-text-${i}`}
                defaultValue={row.text}
                error={on(`step-text-${i}`)}
              />
            </fieldset>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <Button kind="main" type="submit">
            {messages.recipeFormSave}
          </Button>
          <a
            href={cancel}
            className="text-body text-accent underline underline-offset-4 transition-colors hover:text-text"
          >
            {messages.recipeFormCancel}
          </a>
        </div>
      </form>
    </section>
  );
}
