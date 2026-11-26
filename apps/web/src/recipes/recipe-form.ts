// The recipe form, new and edit alike: what it posts, the body the API takes,
// the API's own rules checked before posting, and the draft that keeps what
// was typed when a form posted with no JavaScript comes back with an error.

// What was typed, as typed: every field a string, every row kept, empty or
// not, so the form can be shown again exactly.
export type IngredientRow = { order: string; quantity: string; unit: string; name: string };
type StepRow = { order: string; text: string };
export type RecipeFormValues = {
  title: string;
  servings: string;
  time: string;
  source: string;
  ingredients: IngredientRow[];
  steps: StepRow[];
};

// Rows are posted as ingredient-<field>-<index> and step-<field>-<index>.
function rowCount(form: FormData, prefix: string): number {
  let count = 0;
  for (const name of form.keys()) {
    const index = new RegExp(`^${prefix}-[a-z]+-(\\d+)$`).exec(name)?.[1];
    if (index !== undefined) count = Math.max(count, Number(index) + 1);
  }
  return count;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export function readRecipeForm(form: FormData): RecipeFormValues {
  return {
    title: field(form, "title"),
    servings: field(form, "servings"),
    time: field(form, "time"),
    source: field(form, "source"),
    ingredients: Array.from({ length: rowCount(form, "ingredient") }, (_, i) => ({
      order: field(form, `ingredient-order-${i}`),
      quantity: field(form, `ingredient-quantity-${i}`),
      unit: field(form, `ingredient-unit-${i}`),
      name: field(form, `ingredient-name-${i}`),
    })),
    steps: Array.from({ length: rowCount(form, "step") }, (_, i) => ({
      order: field(form, `step-order-${i}`),
      text: field(form, `step-text-${i}`),
    })),
  };
}

const orNull = (value: string) => value.trim() || null;
const isEmpty = (row: IngredientRow) =>
  !row.quantity.trim() && !row.unit.trim() && !row.name.trim();

// Rows in their "Orden" number; a row whose number isn't a number, or repeats
// another's, keeps its place (the sort is stable).
function inOrder<T extends { order: string }>(rows: T[]): T[] {
  const key = (row: T) => {
    const number = Number(row.order.trim());
    return row.order.trim() !== "" && Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
  };
  return [...rows].sort((a, b) => key(a) - key(b));
}

// The body of POST /recipes and PUT /recipes/{id}: empty rows left out, rows
// in their order, empty fields null. The language is the page's for a new
// recipe and the recipe's own for an edited one.
export function toRecipeInput(values: RecipeFormValues, language: string) {
  return {
    title: values.title.trim(),
    language,
    servings: orNull(values.servings),
    time: orNull(values.time),
    source: orNull(values.source),
    ingredients: inOrder(values.ingredients.filter((row) => !isEmpty(row))).map((row) => ({
      quantity: orNull(row.quantity),
      unit: orNull(row.unit),
      name: row.name.trim(),
    })),
    steps: inOrder(values.steps.filter((row) => row.text.trim())).map((row) => row.text.trim()),
  };
}

const RECIPE_ERROR_KINDS = [
  "title-missing",
  "source-invalid",
  "ingredient-name-missing",
  "ingredients-missing",
  "steps-missing",
  "refused",
  "unreachable",
  "api-error",
] as const;
export type RecipeErrorKind = (typeof RECIPE_ERROR_KINDS)[number];

// The form page's ?error= and ?field=, which anyone can type: a known kind on
// a field the form has, or none.
const FIELD =
  /^(title|servings|time|source|ingredient-(order|quantity|unit|name)-\d+|step-(order|text)-\d+)$/;

export function parseRecipeError(
  kind: unknown,
  field: unknown,
): { kind: RecipeErrorKind; field: string } | undefined {
  const known = RECIPE_ERROR_KINDS.find((k) => k === kind);
  return known && typeof field === "string" && FIELD.test(field)
    ? { kind: known, field }
    : undefined;
}

// The API checks the source with zod's z.httpUrl() (apps/api/src/recipes/
// recipes.routes.ts), which is stricter than the document's format: uri: an
// http or https address whose host matches zod's domain rule, copied here
// from zod 4's regexes.domain, so not localhost, not an IP address, no
// underscore and no empty label. Keep the two in step: a source the web lets
// through and the API refuses comes back only as "refused", on no field.
const DOMAIN = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  return (protocol === "http:" || protocol === "https:") && DOMAIN.test(hostname);
}

// The API's rules for a recipe, checked in the form's order, so the first
// field with an error is the one that gets the focus. The API's 400 names no
// field, so this is what does.
export function checkRecipe(
  values: RecipeFormValues,
): { field: string; kind: RecipeErrorKind } | undefined {
  if (!values.title.trim()) return { field: "title", kind: "title-missing" };
  const source = values.source.trim();
  if (source && !isHttpUrl(source)) return { field: "source", kind: "source-invalid" };
  const nameless = values.ingredients.findIndex((row) => !isEmpty(row) && !row.name.trim());
  if (nameless !== -1) {
    return { field: `ingredient-name-${nameless}`, kind: "ingredient-name-missing" };
  }
  if (!values.ingredients.some((row) => row.name.trim())) {
    return { field: "ingredient-name-0", kind: "ingredients-missing" };
  }
  if (!values.steps.some((row) => row.text.trim())) {
    return { field: "step-text-0", kind: "steps-missing" };
  }
  return undefined;
}

// The form page's validated search: the same two strings the address has.
// Never an object: the router rewrites an address whose validated search
// differs in shape from its query, and ?field= would be lost on the way.
export function recipeErrorSearch(search: Record<string, unknown>): {
  error: RecipeErrorKind | undefined;
  field: string | undefined;
} {
  const parsed = parseRecipeError(search.error, search.field);
  return { error: parsed?.kind, field: parsed?.field };
}

// The draft: what was typed, in cookies of the web app's own, for the page
// that shows the form again after an error. RFC 6265, section 6.1, asks
// browsers to keep at least 4096 bytes per cookie, name and attributes
// included; each chunk stays under 4000. A form that needs more than 3 is not
// kept: 4 make a Cookie header of about 15.4 KB, and with a few other cookies
// Node's HTTP server, which vite dev uses, answers every page 431 (it takes
// 16384 bytes of headers in all) until the draft expires. They never go to
// the API: relayHeaders leaves them out.
//
// A draft names the form it was typed in, "new" or the recipe's id, and is
// read only there: on another recipe's form, saving would overwrite it.
const DRAFT = "recipe_draft_";
const DRAFT_CHUNKS = 3;
const CHUNK_LENGTH = 3800;

type CookieOptions = { secure: boolean };
const attributes = ({ secure }: CookieOptions) =>
  `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

export function clearDraftCookies(options: CookieOptions): string[] {
  return Array.from(
    { length: DRAFT_CHUNKS },
    (_, i) => `${DRAFT}${i}=; ${attributes(options)}; Max-Age=0`,
  );
}

// The cookies that hold the draft, the chunks it doesn't use deleted, or
// undefined when it doesn't fit.
export function draftCookies(
  values: RecipeFormValues,
  options: CookieOptions,
  form: string,
): string[] | undefined {
  const encoded = encodeURIComponent(JSON.stringify({ form, values }));
  const chunks = encoded.match(new RegExp(`.{1,${CHUNK_LENGTH}}`, "g")) ?? [];
  if (chunks.length > DRAFT_CHUNKS) return undefined;
  const cleared = clearDraftCookies(options);
  return cleared.map((empty, i) => {
    const chunk = chunks[i];
    return chunk === undefined
      ? empty
      : `${DRAFT}${i}=${chunk}; ${attributes(options)}; Max-Age=300`;
  });
}

const isString = (value: unknown): value is string => typeof value === "string";

function isFormValues(value: unknown): value is RecipeFormValues {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    [v.title, v.servings, v.time, v.source].every(isString) &&
    Array.isArray(v.ingredients) &&
    v.ingredients.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        ["order", "quantity", "unit", "name"].every((key) =>
          isString((row as Record<string, unknown>)[key]),
        ),
    ) &&
    Array.isArray(v.steps) &&
    v.steps.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        ["order", "text"].every((key) => isString((row as Record<string, unknown>)[key])),
    )
  );
}

// A broken or foreign value reads as none: the cookies are the browser's to send.
export function readDraft(
  cookieHeader: string | undefined,
  form: string,
): RecipeFormValues | undefined {
  if (!cookieHeader) return undefined;
  const parts = new Map(
    cookieHeader.split(";").map((part) => {
      const [name = "", ...rest] = part.trim().split("=");
      return [name, rest.join("=")] as const;
    }),
  );
  const encoded = Array.from(
    { length: DRAFT_CHUNKS },
    (_, i) => parts.get(`${DRAFT}${i}`) ?? "",
  ).join("");
  if (!encoded) return undefined;
  try {
    const draft: unknown = JSON.parse(decodeURIComponent(encoded));
    if (typeof draft !== "object" || draft === null) return undefined;
    const { form: from, values } = draft as Record<string, unknown>;
    return from === form && isFormValues(values) ? values : undefined;
  } catch {
    return undefined;
  }
}
