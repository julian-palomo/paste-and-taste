import { type ApiClient, ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";
import type { Language } from "../i18n/i18n.ts";
import { type FormResult, relayed } from "../session/relay.ts";
import {
  checkRecipe,
  clearDraftCookies,
  draftCookies,
  type RecipeErrorKind,
  type RecipeFormValues,
  toRecipeInput,
} from "./recipe-form.ts";

// The work of each recipe server function, with no Start import, so tests
// call it with a client and a fake fetch. As the sign-in's: the browser's
// headers go to the API, and each Set-Cookie the API answers with, a renewed
// session's, goes to appendSetCookie unchanged. Where `shown` is false, each
// function calls nothing.
export type RecipesDeps = {
  client: ApiClient;
  headers: Record<string, string>;
  appendSetCookie: (cookie: string) => void;
  shown: boolean;
  origin: string;
};

// What a read gives the page: the data, or why there is none. A loader turns
// signed-out into the sign-in and not-shown or not-found into the 404 page;
// the page shows unreachable and api-error in words.
type Failed = { kind: "signed-out" } | { kind: "unreachable" } | { kind: "api-error" };
type NotShown = { kind: "not-shown" };

const call = ({ headers, appendSetCookie }: RecipesDeps) => relayed(headers, appendSetCookie);
const secure = (deps: RecipesDeps) => ({ secure: new URL(deps.origin).protocol === "https:" });

// The API's errors by class: the connection, or the API's side
// (docs/adr/2026-11-23-api-unreachable-error.md). Anything else is a bug here.
function failed(error: unknown): Failed {
  if (error instanceof ApiError) return { kind: error.status === 401 ? "signed-out" : "api-error" };
  if (error instanceof ApiUnreachableError) return { kind: "unreachable" };
  throw error;
}

export async function listRecipes(deps: RecipesDeps) {
  if (!deps.shown) return { kind: "not-shown" } as NotShown;
  try {
    // Ordered by the API, the last change first.
    const { recipes } = await deps.client.get("/recipes", call(deps));
    return { kind: "ok" as const, recipes };
  } catch (error) {
    return failed(error);
  }
}

export async function readRecipe(deps: RecipesDeps, id: string) {
  if (!deps.shown) return { kind: "not-shown" } as NotShown;
  try {
    const recipe = await deps.client.get("/recipes/{id}", { ...call(deps), params: { id } });
    return { kind: "ok" as const, recipe };
  } catch (error) {
    // Unknown, another user's, or not an id at all: the same not-found page.
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return { kind: "not-found" as const };
    }
    return failed(error);
  }
}

// The API's types, as the client gives them, never copied.
export type RecipeSummary = Extract<
  Awaited<ReturnType<typeof listRecipes>>,
  { kind: "ok" }
>["recipes"][number];
export type Recipe = Extract<Awaited<ReturnType<typeof readRecipe>>, { kind: "ok" }>["recipe"];

// The sign-in, and back to `path` once signed in.
export function signInFor(lang: Language, path: string): string {
  return `/${lang}/sign-in?${new URLSearchParams({ next: path })}`;
}

// Saves the form: POST for a new recipe, PUT for an edited one, then the
// recipe's page. On an error, back to the form with the error's field and
// what was typed, kept in the draft cookies.
export async function saveRecipe(
  deps: RecipesDeps,
  { lang, id, values }: { lang: Language; id?: string; values: RecipeFormValues },
): Promise<FormResult> {
  if (!deps.shown) return { notFound: true };
  const formPage = id ? `/${lang}/recipes/${id}/edit` : `/${lang}/recipes/new`;
  const back = (kind: RecipeErrorKind, field: string): FormResult => {
    for (const cookie of draftCookies(values, secure(deps)) ?? []) deps.appendSetCookie(cookie);
    return { redirect: `${formPage}?${new URLSearchParams({ error: kind, field })}` };
  };

  const refused = checkRecipe(values);
  if (refused) return back(refused.kind, refused.field);

  const body = toRecipeInput(values, lang);
  try {
    const saved = id
      ? await deps.client.put("/recipes/{id}", { ...call(deps), params: { id }, body })
      : await deps.client.post("/recipes", { ...call(deps), body });
    for (const cookie of clearDraftCookies(secure(deps))) deps.appendSetCookie(cookie);
    return { redirect: `/${lang}/recipes/${saved.id}` };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The draft stays: back on the form after signing in, it is still there.
      for (const cookie of draftCookies(values, secure(deps)) ?? []) deps.appendSetCookie(cookie);
      return { redirect: signInFor(lang, formPage) };
    }
    // An edited recipe that is gone or another user's: its page says not found.
    if (id && error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return { redirect: `/${lang}/recipes/${id}` };
    }
    // A rule the web doesn't know: the API's 400 names no field.
    if (error instanceof ApiError && error.status === 400) return back("refused", "title");
    return back(failed(error).kind === "unreachable" ? "unreachable" : "api-error", "title");
  }
}
