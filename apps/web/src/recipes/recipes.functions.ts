import { createApiClient } from "@paste-and-taste/api-client";
import { createServerFn } from "@tanstack/react-start";
import {
  appendResponseHeader,
  getRequestHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";
import { withConfig } from "../config/config.middleware.ts";
import type { WebConfig } from "../config/config.ts";
import { type Language, parseLanguage } from "../i18n/i18n.ts";
import { formResponse, relayHeaders } from "../session/relay.ts";
import { clearDraftCookies, readDraft, readRecipeForm } from "./recipe-form.ts";
import {
  deleteRecipe,
  listRecipes,
  type RecipesDeps,
  readRecipe,
  readSignedIn,
  saveRecipe,
} from "./recipes.ts";
import { recipesShown } from "./recipes-shown.ts";

// The recipes' server functions: each wires the browser's request to the
// work in recipes.ts and hands the API's cookies back. Each is an address of
// its own, so each checks recipesShown itself: a GET answers 404 where the
// recipes aren't shown, and so does the form.

function deps(
  context: { config: WebConfig; origin: string },
  appendSetCookie: (cookie: string) => void,
): RecipesDeps {
  const { baseUrl, fetch } = context.config.api;
  return {
    client: createApiClient(fetch ? { baseUrl, fetch } : { baseUrl }),
    // Start types the names it knows; these three are ordinary headers.
    headers: relayHeaders((name) => getRequestHeader(name as "cookie")),
    appendSetCookie,
    shown: recipesShown(context.config.environment),
    origin: context.origin,
  };
}

const toResponse = (cookie: string) => appendResponseHeader("set-cookie", cookie);

export const getRecipeList = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .handler(async ({ context }) => {
    const state = await listRecipes(deps(context, toResponse));
    if (state.kind === "not-shown") setResponseStatus(404);
    return { state, origin: context.origin };
  });

export const getRecipe = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const state = await readRecipe(deps(context, toResponse), data.id);
    if (state.kind === "not-shown") setResponseStatus(404);
    return { state, origin: context.origin };
  });

// The form's data: the session or the recipe to edit, and the draft of what
// was typed on this same form before an error, which is read once and
// deleted. Only when the page shows the form: a draft kept for after the
// sign-in stays until the form is back.
export const getRecipeForm = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .validator((input: { id: string | null }) => input)
  .handler(async ({ data, context }) => {
    const recipeDeps = deps(context, toResponse);
    if (!recipeDeps.shown) {
      setResponseStatus(404);
      return { kind: "not-shown" as const };
    }
    const takeDraft = (form: string) => {
      const draft = readDraft(getRequestHeader("cookie"), form);
      if (draft) {
        const secure = new URL(context.origin).protocol === "https:";
        for (const cookie of clearDraftCookies({ secure })) toResponse(cookie);
      }
      return draft;
    };
    if (data.id === null) {
      const state = await readSignedIn(recipeDeps);
      const draft = state.kind === "ok" ? takeDraft("new") : undefined;
      return { kind: "new" as const, state, draft, origin: context.origin };
    }
    const state = await readRecipe(recipeDeps, data.id);
    const draft = state.kind === "ok" ? takeDraft(data.id) : undefined;
    return { kind: "edit" as const, state, draft, origin: context.origin };
  });

// The form's language comes with it; anything else goes back in English.
const langOf = (form: FormData): Language => parseLanguage(String(form.get("lang"))) ?? "en";

export const saveRecipeForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(async ({ data, context }) => {
    const cookies: string[] = [];
    const id = data.get("id");
    const language = data.get("language");
    const result = await saveRecipe(
      deps(context, (cookie) => cookies.push(cookie)),
      {
        lang: langOf(data),
        ...(typeof id === "string" && id ? { id } : {}),
        ...(typeof language === "string" && language ? { language } : {}),
        values: readRecipeForm(data),
      },
    );
    return formResponse(result, cookies);
  });

// The delete, sent from its confirmation page: a POST, never a link.
export const deleteRecipeForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(async ({ data, context }) => {
    const cookies: string[] = [];
    const result = await deleteRecipe(
      deps(context, (cookie) => cookies.push(cookie)),
      { lang: langOf(data), id: String(data.get("id") ?? "") },
    );
    return formResponse(result, cookies);
  });
