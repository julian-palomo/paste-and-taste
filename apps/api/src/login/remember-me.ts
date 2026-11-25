import { createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

// "Mantener la sesión iniciada" for the two sign-ins Better Auth gives no such
// option: the code and the passkey. Better Auth's own "don't remember me",
// which only its password sign-in uses, is a cookie with no expiry, a signed
// dont_remember cookie so a session read never renews it, and a session row
// that lasts a day. This hook does the same after a sign-in that didn't tick
// the box.

// Our handlers set it on every sign-in they pass to Better Auth, from the
// request's own body, and never forward a caller's. Better Auth's handler is
// not mounted, so nothing else can set it.
export const REMEMBER_ME_HEADER = "x-remember-me";

const SIGN_IN_PATHS = new Set(["/sign-in/email-otp", "/passkey/verify-authentication"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const rememberMeHook = createAuthMiddleware(async (ctx) => {
  if (!SIGN_IN_PATHS.has(ctx.path)) return;
  // Only an explicit "true" remembers: an unticked box is the default.
  if (ctx.headers?.get(REMEMBER_ME_HEADER) === "true") return;
  const signedIn = ctx.context.newSession;
  if (!signedIn) return;

  const expiresAt = new Date(Date.now() + ONE_DAY_MS);
  await ctx.context.internalAdapter.updateSession(signedIn.session.token, { expiresAt });
  // Replace, never append: setSessionCookie appends, and the endpoint has
  // already written a session cookie that lasts 90 days. Leaving it would send
  // two, and the browser would keep the long one.
  ctx.context.responseHeaders?.delete("set-cookie");
  await setSessionCookie(ctx, { ...signedIn, session: { ...signedIn.session, expiresAt } }, true);
});
