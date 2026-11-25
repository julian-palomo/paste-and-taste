import { ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";
import type { Language } from "../i18n/i18n.ts";

// The address being signed in with, between the address step and the code
// step, in a cookie of the web app's own: never in the page's address, which
// lands in history and logs. sentAt, in milliseconds, is when the last code
// was sent; with none, the address was typed but no code went out.
export type Pending = { email: string; sentAt?: number };

const PENDING = "sign_in_pending";

// Secure only where the page is served over HTTPS: on http://localhost, where
// development runs, a browser may not keep a Secure cookie.
type CookieOptions = { secure: boolean };
const attributes = ({ secure }: CookieOptions) =>
  `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

export function pendingCookie(pending: Pending, options: CookieOptions): string {
  const value = encodeURIComponent(JSON.stringify(pending));
  return `${PENDING}=${value}; ${attributes(options)}; Max-Age=900`;
}

// The same name and attributes as the cookie it deletes, already expired.
export function clearPendingCookie(options: CookieOptions): string {
  return `${PENDING}=; ${attributes(options)}; Max-Age=0`;
}

// A broken or foreign value reads as none: the cookie is the browser's to send.
export function readPending(cookieHeader: string | undefined): Pending | undefined {
  const raw = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PENDING}=`))
    ?.slice(PENDING.length + 1);
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== "object" || value === null) return undefined;
    const { email, sentAt } = value as Record<string, unknown>;
    if (typeof email !== "string") return undefined;
    return typeof sentAt === "number" ? { email, sentAt } : { email };
  } catch {
    return undefined;
  }
}

// What the page says when a step fails, each with its text in the
// translation files. too-soon and start-again are the web app's own.
const ERROR_KINDS = [
  "invalid-email",
  "too-many-codes",
  "wrong-code",
  "too-many",
  "unreachable",
  "too-soon",
  "start-again",
  "passkey-failed",
  "passkey-not-created",
  "code-not-sent",
] as const;
export type SignInErrorKind = (typeof ERROR_KINDS)[number];

// The ?error= of the page's address, which anyone can type: anything that
// isn't a known kind reads as none.
export function parseErrorKind(value: unknown): SignInErrorKind | undefined {
  return ERROR_KINDS.find((kind) => kind === value);
}

// One mapping per kind of route, because the same status means different
// things: a 401 is a wrong code on /login/sign-in and a refused passkey on
// /login/passkey/sign-in. An error that isn't the API's is a bug here, and
// is thrown again.
function byStatus(error: unknown, statuses: Record<number, SignInErrorKind>): SignInErrorKind {
  if (error instanceof ApiError) return statuses[error.status] ?? "unreachable";
  if (error instanceof ApiUnreachableError) return "unreachable";
  throw error;
}

// 502: the API couldn't hand the code to the email sender.
export const codeError = (error: unknown) =>
  byStatus(error, { 400: "invalid-email", 429: "too-many-codes", 502: "code-not-sent" });

export const signInError = (error: unknown) =>
  byStatus(error, { 401: "wrong-code", 429: "too-many" });

// Signing in with a passkey.
export const passkeyError = (error: unknown) =>
  byStatus(error, { 400: "passkey-failed", 401: "passkey-failed", 429: "too-many" });

// Creating one: a refused registration, or a session that ended before it.
export const registrationError = (error: unknown) =>
  byStatus(error, { 400: "passkey-not-created", 401: "passkey-not-created", 429: "too-many" });

// The page a visitor asked for before signing in, from ?next= or a form's
// hidden field: only a path of this site under a language, so a link can't
// use the sign-in to send someone elsewhere. "//host" and a backslash, which
// browsers read as another site, are refused.
export function parseNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!/^\/(en|es)(\/[^\s\\]*)?$/.test(value) || value.includes("//")) return undefined;
  return value;
}

// Where a sign-in goes: back to the page asked for, else the passkey offer
// after a code, or the signed-in page after a passkey.
export function afterSignIn(
  lang: Language,
  next: string | undefined,
  by: "code" | "passkey",
): string {
  if (next) return next;
  return by === "code" ? `/${lang}/sign-in?step=passkey` : `/${lang}/sign-in`;
}
