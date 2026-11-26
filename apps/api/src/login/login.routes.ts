import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { InvalidRequestError } from "../errors/invalid-request-error.ts";
import { ProblemDetails, problemResponses } from "../errors/problem-details.ts";
import { toAppError } from "./auth-errors.ts";
import type { CodeSender } from "./code-sender.ts";
import { uninvite } from "./invited-address.repository.ts";
import {
  InvalidCodeError,
  NotSignedInError,
  PasskeyNotRegisteredError,
  PasskeyRefusedError,
} from "./login-errors.ts";
import { REMEMBER_ME_HEADER } from "./remember-me.ts";
import { LIMITS, type RequestLimiter } from "./request-limiter.ts";
import { mayGetCode, type SignUp } from "./sign-up.ts";
import type { Auth, WithAuth } from "./with-auth.ts";

type LoginDeps = {
  withAuth: WithAuth;
  requestLimiter: RequestLimiter;
  codeSender: CodeSender;
  signUp: SignUp;
};

const User = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi("User");
const SignedIn = z.object({ user: User }).openapi("SignedIn");
const CodeRequest = z
  .object({
    email: z.email(),
    // The email's language: the page the user asked from. English when
    // missing, as the web app's fallback (docs/adr/2026-11-23-web-addresses-per-language.md).
    language: z.enum(["es", "en"]).optional(),
  })
  .openapi("CodeRequest");
const CodeSent = z.object({ sent: z.literal(true) }).openapi("CodeSent");
const SignInRequest = z
  .object({ email: z.email(), code: z.string(), rememberMe: z.boolean() })
  .openapi("SignInRequest");
const SignedOut = z.object({ signedOut: z.literal(true) }).openapi("SignedOut");
// WebAuthn's options and a device's answer, passed through as they are: the
// browser's WebAuthn API reads the first and writes the second.
const WebAuthnJson = z.record(z.string(), z.unknown());
const PasskeyOptions = WebAuthnJson.openapi("PasskeyOptions");
const PasskeyRegistrationRequest = z
  .object({ response: WebAuthnJson })
  .openapi("PasskeyRegistrationRequest");
const PasskeyRegistered = z.object({ registered: z.literal(true) }).openapi("PasskeyRegistered");
const PasskeySignInRequest = z
  .object({ response: WebAuthnJson, rememberMe: z.boolean() })
  .openapi("PasskeySignInRequest");

function problem(description: string) {
  return { description, content: { "application/problem+json": { schema: ProblemDetails } } };
}

function jsonBody<T extends z.ZodType>(schema: T) {
  return { body: { required: true, content: { "application/json": { schema } } } };
}

const askForCode = createRoute({
  method: "post",
  path: "/code",
  request: jsonBody(CodeRequest),
  responses: {
    200: {
      description: "A sign-in code was sent to the address.",
      content: { "application/json": { schema: CodeSent } },
    },
    429: problem("Too many codes for this address or from this IP."),
    502: problem("The code could not be sent: try again in a moment."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const signIn = createRoute({
  method: "post",
  path: "/sign-in",
  request: jsonBody(SignInRequest),
  responses: {
    200: {
      description:
        "Signed in. Sets the session cookie: with no expiry when rememberMe is false, for 90 days when true.",
      content: { "application/json": { schema: SignedIn } },
    },
    401: problem("The code is wrong, expired or used up."),
    429: problem("Too many login requests from this IP."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const readSession = createRoute({
  method: "get",
  path: "/session",
  responses: {
    200: {
      description:
        "The signed-in user. When the session is renewed, the response carries the renewed cookie.",
      content: { "application/json": { schema: SignedIn } },
    },
    401: problem("There is no session."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const signOut = createRoute({
  method: "post",
  path: "/sign-out",
  responses: {
    200: {
      description: "Signed out. Clears the session cookies.",
      content: { "application/json": { schema: SignedOut } },
    },
    401: problem("There is no session."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const passkeyRegistrationOptions = createRoute({
  method: "post",
  path: "/passkey/registration-options",
  responses: {
    200: {
      description:
        "The options for the browser's WebAuthn registration. Sets the registration challenge cookie, which the registration needs.",
      content: { "application/json": { schema: PasskeyOptions } },
    },
    401: problem("There is no session."),
    429: problem("Too many login requests from this IP."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const passkeyRegistration = createRoute({
  method: "post",
  path: "/passkey/registration",
  request: jsonBody(PasskeyRegistrationRequest),
  responses: {
    200: {
      description: "The passkey is registered for the signed-in user.",
      content: { "application/json": { schema: PasskeyRegistered } },
    },
    400: problem("The passkey could not be registered: sign in again and retry."),
    401: problem("There is no session."),
    429: problem("Too many login requests from this IP."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const passkeySignInOptions = createRoute({
  method: "post",
  path: "/passkey/sign-in-options",
  responses: {
    200: {
      description:
        "The options for the browser's WebAuthn sign-in. Sets the sign-in challenge cookie, which the sign-in needs.",
      content: { "application/json": { schema: PasskeyOptions } },
    },
    429: problem("Too many login requests from this IP."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

const passkeySignIn = createRoute({
  method: "post",
  path: "/passkey/sign-in",
  request: jsonBody(PasskeySignInRequest),
  responses: {
    200: {
      description:
        "Signed in. Sets the session cookie: with no expiry when rememberMe is false, for 90 days when true.",
      content: { "application/json": { schema: SignedIn } },
    },
    401: problem("The passkey was not accepted."),
    429: problem("Too many login requests from this IP."),
    503: problem("Login is not configured on this server."),
    ...problemResponses,
  },
});

// The device's answer as Better Auth's sign-in types it. The route passes it
// through untyped (WebAuthnJson), and Better Auth checks its shape itself.
type PasskeyAnswer = NonNullable<
  Parameters<Auth["api"]["verifyPasskeyAuthentication"]>[0]
>["body"]["response"];

const PASSKEY_SIGN_IN_ERRORS = {
  PASSKEY_NOT_FOUND: () => new PasskeyRefusedError(),
  AUTHENTICATION_FAILED: () => new PasskeyRefusedError(),
  CHALLENGE_NOT_FOUND: () => new PasskeyRefusedError(),
};

const PASSKEY_REGISTRATION_ERRORS = {
  SESSION_REQUIRED: () => new NotSignedInError(),
  CHALLENGE_NOT_FOUND: () => new PasskeyNotRegisteredError(),
  FAILED_TO_VERIFY_REGISTRATION: () => new PasskeyNotRegisteredError(),
  PREVIOUSLY_REGISTERED: () => new PasskeyNotRegisteredError(),
  YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY: () => new PasskeyNotRegisteredError(),
  SESSION_NOT_FRESH: () => new PasskeyNotRegisteredError(),
};

const CODE_ERRORS = {
  INVALID_OTP: () => new InvalidCodeError(),
  OTP_EXPIRED: () => new InvalidCodeError(),
  TOO_MANY_ATTEMPTS: () => new InvalidCodeError(),
};

// The client's IP as Cloudflare reports it. With none, every such request
// shares one count, which still limits.
function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

// What Better Auth may see of the request: its cookies, the IP and the user
// agent. Nothing else is forwarded, so a caller can't set our own headers.
function forwardedHeaders(c: Context): Headers {
  const headers = new Headers();
  for (const name of ["cookie", "cf-connecting-ip", "user-agent"]) {
    const value = c.req.header(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

// Each Set-Cookie Better Auth wrote, as its own header, in order.
function relayCookies(c: Context, from: Headers): void {
  for (const cookie of from.getSetCookie()) c.header("set-cookie", cookie, { append: true });
}

function toUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

export function loginRoutes({
  withAuth,
  requestLimiter,
  codeSender,
  signUp,
}: LoginDeps): OpenAPIHono {
  const app = new OpenAPIHono({
    defaultHook: (result) => {
      if (!result.success) throw new InvalidRequestError("The request body is not valid.");
    },
  });

  app.openapi(askForCode, async (c) => {
    const { email: given, language = "en" } = c.req.valid("json");
    const email = given.toLowerCase();
    const pending = await withAuth(c.req.raw, async (auth, db, outbox) => {
      await requestLimiter.check(db, LIMITS.codePerIp, clientIp(c));
      await requestLimiter.check(db, LIMITS.codePerAddress, email);
      // An address that may not get a code gets the same answer as one that
      // does, and nothing is made or sent: the answer tells a stranger
      // nothing about who is invited or has an account.
      if (!(await mayGetCode(db, signUp, email))) return undefined;
      await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
      return outbox.take();
    });
    // Sent here, once the database client is closed, so a slow sender never
    // holds it and a failure reaches this answer (see outbox.ts).
    if (pending) await codeSender.send(pending.email, pending.code, language);
    return c.json({ sent: true as const }, 200);
  });

  app.openapi(signIn, (c) =>
    withAuth(c.req.raw, async (auth, db) => {
      const { email, code, rememberMe } = c.req.valid("json");
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
      // The same 401 as a wrong code, and Better Auth never sees the address,
      // so no account can come out of it.
      if (!(await mayGetCode(db, signUp, email.toLowerCase()))) throw new InvalidCodeError();
      const headers = forwardedHeaders(c);
      headers.set(REMEMBER_ME_HEADER, String(rememberMe));
      const result = await auth.api
        .signInEmailOTP({
          body: { email: email.toLowerCase(), otp: code },
          headers,
          returnHeaders: true,
        })
        .catch((error: unknown) => {
          throw toAppError(error, CODE_ERRORS);
        });
      // Its account lets it in from now on, so the invitation goes: the
      // address isn't kept twice.
      await uninvite(db, email);
      relayCookies(c, result.headers);
      return c.json({ user: toUser(result.response.user) }, 200);
    }),
  );

  app.openapi(readSession, (c) =>
    withAuth(c.req.raw, async (auth) => {
      const result = await auth.api.getSession({
        headers: forwardedHeaders(c),
        returnHeaders: true,
      });
      if (!result.response) throw new NotSignedInError();
      relayCookies(c, result.headers);
      return c.json({ user: toUser(result.response.user) }, 200);
    }),
  );

  app.openapi(signOut, (c) =>
    withAuth(c.req.raw, async (auth) => {
      const headers = forwardedHeaders(c);
      if (!(await auth.api.getSession({ headers }))) throw new NotSignedInError();
      const result = await auth.api.signOut({ headers, returnHeaders: true });
      relayCookies(c, result.headers);
      return c.json({ signedOut: true as const }, 200);
    }),
  );

  app.openapi(passkeyRegistrationOptions, (c) =>
    withAuth(c.req.raw, async (auth, db) => {
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
      const headers = forwardedHeaders(c);
      if (!(await auth.api.getSession({ headers }))) throw new NotSignedInError();
      const result = await auth.api
        .generatePasskeyRegistrationOptions({ headers, returnHeaders: true })
        .catch((error: unknown) => {
          throw toAppError(error, PASSKEY_REGISTRATION_ERRORS);
        });
      relayCookies(c, result.headers);
      return c.json(result.response as unknown as Record<string, unknown>, 200);
    }),
  );

  app.openapi(passkeyRegistration, (c) =>
    withAuth(c.req.raw, async (auth, db) => {
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
      const headers = forwardedHeaders(c);
      if (!(await auth.api.getSession({ headers }))) throw new NotSignedInError();
      const { response } = c.req.valid("json");
      await auth.api
        .verifyPasskeyRegistration({ body: { response }, headers })
        .catch((error: unknown) => {
          throw toAppError(error, PASSKEY_REGISTRATION_ERRORS);
        });
      return c.json({ registered: true as const }, 200);
    }),
  );

  app.openapi(passkeySignInOptions, (c) =>
    withAuth(c.req.raw, async (auth, db) => {
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
      const result = await auth.api.generatePasskeyAuthenticationOptions({
        headers: forwardedHeaders(c),
        returnHeaders: true,
      });
      relayCookies(c, result.headers);
      return c.json(result.response as unknown as Record<string, unknown>, 200);
    }),
  );

  app.openapi(passkeySignIn, (c) =>
    withAuth(c.req.raw, async (auth, db) => {
      const { response, rememberMe } = c.req.valid("json");
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
      const headers = forwardedHeaders(c);
      headers.set(REMEMBER_ME_HEADER, String(rememberMe));
      const result = await auth.api
        .verifyPasskeyAuthentication({
          body: { response: response as unknown as PasskeyAnswer },
          headers,
          returnHeaders: true,
        })
        .catch((error: unknown) => {
          throw toAppError(error, PASSKEY_SIGN_IN_ERRORS);
        });
      relayCookies(c, result.headers);
      return c.json({ user: toUser(result.response.user) }, 200);
    }),
  );

  return app;
}
