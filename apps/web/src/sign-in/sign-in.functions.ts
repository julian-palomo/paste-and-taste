import { createApiClient } from "@paste-and-taste/api-client";
import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequestHeader } from "@tanstack/react-start/server";
import { withConfig } from "../config/config.middleware.ts";
import type { WebConfig } from "../config/config.ts";
import { type Language, parseLanguage } from "../i18n/i18n.ts";
import { readPending, relayHeaders, type SignInErrorKind } from "./relay.ts";
import {
  changeAddress,
  formResponse,
  passkeyRegistrationOptions,
  passkeySignIn,
  passkeySignInOptions,
  readSession,
  registerPasskey,
  type SignInDeps,
  sendCode,
  signIn,
  signOut,
} from "./sign-in.ts";
import { signInShown } from "./sign-in-shown.ts";

// The sign-in's server functions: each wires the browser's request to the
// work in sign-in.ts and hands the API's cookies back. Nothing here reads,
// rewrites or logs a cookie.

// Every function gets signInShown with its deps, and calls nothing where it
// is false: each is an address of its own, reachable without the page.
function deps(
  context: { config: WebConfig; origin: string },
  appendSetCookie: (cookie: string) => void,
): SignInDeps {
  const { baseUrl, fetch } = context.config.api;
  return {
    client: createApiClient(fetch ? { baseUrl, fetch } : { baseUrl }),
    // Start types the names it knows; these three are ordinary headers.
    headers: relayHeaders((name) => getRequestHeader(name as "cookie")),
    appendSetCookie,
    now: Date.now,
    shown: signInShown(context.config.environment),
    origin: context.origin,
  };
}

// Each form sends its page's language; anything else goes back in English.
const langOf = (form: FormData): Language => parseLanguage(String(form.get("lang"))) ?? "en";
const pending = () => readPending(getRequestHeader("cookie"));

export const getSignInPage = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .handler(async ({ context }) => {
    // Checked first: outside development nothing calls the API, whose
    // /login routes don't exist there, and the page answers 404.
    if (!signInShown(context.config.environment)) return { shown: false as const };
    const session = await readSession(
      deps(context, (cookie) => appendResponseHeader("set-cookie", cookie)),
    );
    return { shown: true as const, origin: context.origin, session, pending: pending() };
  });

export const sendCodeForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(async ({ data, context }) => {
    const cookies: string[] = [];
    const result = await sendCode(
      deps(context, (c) => cookies.push(c)),
      {
        lang: langOf(data),
        email: String(data.get("email") ?? "").trim(),
        pending: pending(),
      },
    );
    return formResponse(result, cookies);
  });

export const signInForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(async ({ data, context }) => {
    const cookies: string[] = [];
    const result = await signIn(
      deps(context, (c) => cookies.push(c)),
      {
        lang: langOf(data),
        code: String(data.get("code") ?? "").trim(),
        // A ticked checkbox is sent as remember=on; an unticked one isn't sent.
        remember: data.get("remember") === "on",
        pending: pending(),
      },
    );
    return formResponse(result, cookies);
  });

export const changeAddressForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(({ data, context }) => {
    const cookies: string[] = [];
    const result = changeAddress(
      deps(context, (c) => cookies.push(c)),
      {
        lang: langOf(data),
      },
    );
    return formResponse(result, cookies);
  });

export const signOutForm = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((form: FormData) => form)
  .handler(async ({ data, context }) => {
    const cookies: string[] = [];
    const result = await signOut(
      deps(context, (c) => cookies.push(c)),
      {
        lang: langOf(data),
      },
    );
    return formResponse(result, cookies);
  });

// The passkey's four steps, called from the browser with JavaScript: WebAuthn
// runs there, and its options and answers pass through here as they are. They
// cross as JSON text: Start serializes only values whose type it can check,
// and the API types them as any JSON object.
const appendToResponse = (cookie: string) => appendResponseHeader("set-cookie", cookie);

type OptionsResult = { ok: true; optionsJson: string } | { ok: false; error: SignInErrorKind };

function asText(result: Awaited<ReturnType<typeof passkeySignInOptions>>): OptionsResult {
  return result.ok ? { ok: true, optionsJson: JSON.stringify(result.options) } : result;
}

export const passkeyRegistrationOptionsFn = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .handler(async ({ context }) =>
    asText(await passkeyRegistrationOptions(deps(context, appendToResponse))),
  );

export const registerPasskeyFn = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((input: { responseJson: string }) => input)
  .handler(({ data, context }) => registerPasskey(deps(context, appendToResponse), data));

export const passkeySignInOptionsFn = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .handler(async ({ context }) =>
    asText(await passkeySignInOptions(deps(context, appendToResponse))),
  );

export const passkeySignInFn = createServerFn({ method: "POST" })
  .middleware([withConfig])
  .validator((input: { responseJson: string; rememberMe: boolean }) => input)
  .handler(({ data, context }) => passkeySignIn(deps(context, appendToResponse), data));
