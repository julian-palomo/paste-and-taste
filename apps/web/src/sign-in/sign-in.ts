import { type ApiClient, ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";
import type { Language } from "../i18n/i18n.ts";
import {
  clearPendingCookie,
  codeError,
  type Pending,
  passkeyError,
  pendingCookie,
  type SignInErrorKind,
  signInError,
} from "./relay.ts";

// The work of each sign-in server function, with no Start import, so tests
// call it with a client and a fake fetch. `headers` are the browser's, from
// relayHeaders; each Set-Cookie the API answers with goes to appendSetCookie
// unchanged, and from there to the browser. `shown` is signInShown for this
// environment: where it is false, every function calls nothing. `origin` is
// the page's, which says whether the site is served over HTTPS.
export type SignInDeps = {
  client: ApiClient;
  headers: Record<string, string>;
  appendSetCookie: (cookie: string) => void;
  now: () => number;
  shown: boolean;
  origin: string;
};

// Where the browser goes next: each form's answer is a 303 to this address,
// or a 404 where the sign-in isn't shown.
type Redirect = { redirect: string };
type FormResult = Redirect | { notFound: true };
const notFound = { notFound: true } as const;

// A form posted with no JavaScript gets this Response as it is: a 303 back to
// the page, carrying every cookie to set, or a 404 with none.
export function formResponse(result: FormResult, cookies: string[]): Response {
  if ("notFound" in result) return new Response(null, { status: 404 });
  const headers = new Headers({ Location: result.redirect });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

const secure = (deps: SignInDeps) => ({ secure: new URL(deps.origin).protocol === "https:" });
// Where the sign-in isn't shown, a passkey function fails without calling
// the API; the page isn't there to show it.
const notShownPasskey = { ok: false, error: "unreachable" } as const;

type WebAuthnJson = Record<string, unknown>;
type PasskeyResult<T> = ({ ok: true } & T) | { ok: false; error: SignInErrorKind };

// How long after a code the address step refuses to send another.
const RESEND_WAIT_MS = 60_000;

const page = (lang: Language, query = "") => `/${lang}/sign-in${query}`;
const withError = (lang: Language, kind: SignInErrorKind) => page(lang, `?error=${kind}`);

function call({ headers, appendSetCookie }: SignInDeps) {
  return {
    headers,
    onSetCookie: (cookies: string[]) => {
      for (const cookie of cookies) appendSetCookie(cookie);
    },
  };
}

export async function sendCode(
  deps: SignInDeps,
  input: { lang: Language; email: string; pending?: Pending | undefined },
): Promise<FormResult> {
  if (!deps.shown) return notFound;
  const { lang, email, pending } = input;
  if (pending?.sentAt !== undefined && deps.now() - pending.sentAt < RESEND_WAIT_MS) {
    return { redirect: withError(lang, "too-soon") };
  }
  try {
    await deps.client.post("/login/code", { ...call(deps), body: { email } });
  } catch (error) {
    // The typed address stays, so the field shows it again.
    deps.appendSetCookie(pendingCookie({ email }, secure(deps)));
    return { redirect: withError(lang, codeError(error)) };
  }
  deps.appendSetCookie(pendingCookie({ email, sentAt: deps.now() }, secure(deps)));
  return { redirect: page(lang) };
}

export async function signIn(
  deps: SignInDeps,
  input: { lang: Language; code: string; remember: boolean; pending?: Pending | undefined },
): Promise<FormResult> {
  if (!deps.shown) return notFound;
  const { lang, code, remember, pending } = input;
  // The pending cookie lasts 15 minutes; past that, the address is gone.
  if (pending?.sentAt === undefined) return { redirect: withError(lang, "start-again") };
  try {
    await deps.client.post("/login/sign-in", {
      ...call(deps),
      body: { email: pending.email, code, rememberMe: remember },
    });
  } catch (error) {
    return { redirect: withError(lang, signInError(error)) };
  }
  deps.appendSetCookie(clearPendingCookie(secure(deps)));
  return { redirect: page(lang, "?step=passkey") };
}

export function changeAddress(deps: SignInDeps, { lang }: { lang: Language }): FormResult {
  if (!deps.shown) return notFound;
  deps.appendSetCookie(clearPendingCookie(secure(deps)));
  return { redirect: page(lang) };
}

export async function signOut(deps: SignInDeps, { lang }: { lang: Language }): Promise<FormResult> {
  if (!deps.shown) return notFound;
  try {
    await deps.client.post("/login/sign-out", call(deps));
  } catch (error) {
    // A 401 means there was no session: the user is signed out either way.
    if (!(error instanceof ApiError && error.status === 401)) {
      return { redirect: withError(lang, signInError(error)) };
    }
  }
  return { redirect: page(lang) };
}

export type Session =
  | { kind: "signed-in"; user: { id: string; email: string; name: string } }
  | { kind: "signed-out" }
  | { kind: "unreachable" };

export async function readSession(deps: SignInDeps): Promise<Session> {
  if (!deps.shown) return { kind: "signed-out" };
  try {
    const { user } = await deps.client.get("/login/session", call(deps));
    return { kind: "signed-in", user };
  } catch (error) {
    // A 401 is no session, a state and not an error.
    if (error instanceof ApiError && error.status === 401) return { kind: "signed-out" };
    if (error instanceof ApiError || error instanceof ApiUnreachableError) {
      return { kind: "unreachable" };
    }
    // Anything else is a bug here, not a state of the API.
    throw error;
  }
}

export async function passkeyRegistrationOptions(
  deps: SignInDeps,
): Promise<PasskeyResult<{ options: WebAuthnJson }>> {
  if (!deps.shown) return notShownPasskey;
  try {
    return {
      ok: true,
      options: await deps.client.post("/login/passkey/registration-options", call(deps)),
    };
  } catch (error) {
    return { ok: false, error: passkeyError(error) };
  }
}

export async function registerPasskey(
  deps: SignInDeps,
  { response }: { response: WebAuthnJson },
): Promise<PasskeyResult<object>> {
  if (!deps.shown) return notShownPasskey;
  try {
    await deps.client.post("/login/passkey/registration", { ...call(deps), body: { response } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: passkeyError(error) };
  }
}

export async function passkeySignInOptions(
  deps: SignInDeps,
): Promise<PasskeyResult<{ options: WebAuthnJson }>> {
  if (!deps.shown) return notShownPasskey;
  try {
    return {
      ok: true,
      options: await deps.client.post("/login/passkey/sign-in-options", call(deps)),
    };
  } catch (error) {
    return { ok: false, error: passkeyError(error) };
  }
}

export async function passkeySignIn(
  deps: SignInDeps,
  { response, rememberMe }: { response: WebAuthnJson; rememberMe: boolean },
): Promise<PasskeyResult<object>> {
  if (!deps.shown) return notShownPasskey;
  try {
    await deps.client.post("/login/passkey/sign-in", {
      ...call(deps),
      body: { response, rememberMe },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: passkeyError(error) };
  }
}
