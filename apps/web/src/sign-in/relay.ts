import { ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";

// What the web app's server passes on to the API about the browser. Only
// these three, so a browser can't set anything else on the API's request.
// The IP is read as the cf-connecting-ip header, never with Start's
// getRequestIP, which reads x-forwarded-for or the socket's address and finds
// nothing on Workers.
const RELAYED = ["cookie", "cf-connecting-ip", "user-agent"] as const;

export function relayHeaders(get: (name: string) => string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of RELAYED) {
    const value = get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

// The address being signed in with, between the address step and the code
// step, in a cookie of the web app's own: never in the page's address, which
// lands in history and logs. sentAt, in milliseconds, is when the last code
// was sent; with none, the address was typed but no code went out.
export type Pending = { email: string; sentAt?: number };

const PENDING = "sign_in_pending";
const PENDING_ATTRIBUTES = "Path=/; HttpOnly; SameSite=Lax";

export function pendingCookie(pending: Pending): string {
  const value = encodeURIComponent(JSON.stringify(pending));
  return `${PENDING}=${value}; ${PENDING_ATTRIBUTES}; Max-Age=900`;
}

// Same name and path, already expired: the browser deletes the cookie.
export const clearPendingCookie = `${PENDING}=; ${PENDING_ATTRIBUTES}; Max-Age=0`;

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
export type SignInErrorKind =
  | "invalid-email"
  | "too-many-codes"
  | "wrong-code"
  | "too-many"
  | "unreachable"
  | "too-soon"
  | "start-again"
  | "passkey-failed";

// One mapping per kind of route, because the same status means different
// things: a 401 is a wrong code on /login/sign-in and a refused passkey on
// /login/passkey/sign-in. An error that isn't the API's is a bug here, and
// is thrown again.
function byStatus(error: unknown, statuses: Record<number, SignInErrorKind>): SignInErrorKind {
  if (error instanceof ApiError) return statuses[error.status] ?? "unreachable";
  if (error instanceof ApiUnreachableError) return "unreachable";
  throw error;
}

export const codeError = (error: unknown) =>
  byStatus(error, { 400: "invalid-email", 429: "too-many-codes" });

export const signInError = (error: unknown) =>
  byStatus(error, { 401: "wrong-code", 429: "too-many" });

export const passkeyError = (error: unknown) =>
  byStatus(error, { 400: "passkey-failed", 401: "passkey-failed", 429: "too-many" });
