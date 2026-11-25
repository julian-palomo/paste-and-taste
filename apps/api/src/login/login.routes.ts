import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { Database, WithDatabase } from "../database/database.ts";
import { ProblemDetails, problemResponses } from "../errors/problem-details.ts";
import { createAuth } from "./auth.ts";
import { toAppError } from "./auth-errors.ts";
import type { CodeSender } from "./code-sender.ts";
import {
  InvalidCodeError,
  InvalidRequestError,
  LoginNotConfiguredError,
  NotSignedInError,
} from "./login-errors.ts";
import { REMEMBER_ME_HEADER } from "./remember-me.ts";
import { LIMITS, type RequestLimiter } from "./request-limiter.ts";

type LoginSettings = { secret?: string | undefined };

type LoginDeps = {
  withDatabase: WithDatabase;
  codeSender: CodeSender;
  requestLimiter: RequestLimiter;
  settings: LoginSettings;
};

const User = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi("User");
const SignedIn = z.object({ user: User }).openapi("SignedIn");
const CodeRequest = z.object({ email: z.email() }).openapi("CodeRequest");
const CodeSent = z.object({ sent: z.literal(true) }).openapi("CodeSent");
const SignInRequest = z
  .object({ email: z.email(), code: z.string(), rememberMe: z.boolean() })
  .openapi("SignInRequest");
const SignedOut = z.object({ signedOut: z.literal(true) }).openapi("SignedOut");

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
  withDatabase,
  codeSender,
  requestLimiter,
  settings,
}: LoginDeps): OpenAPIHono {
  // One Better Auth instance and one database client for this request, both
  // gone when it ends.
  function withAuth<T>(
    c: Context,
    work: (auth: ReturnType<typeof createAuth>, db: Database) => Promise<T>,
  ): Promise<T> {
    const { secret } = settings;
    if (!secret) throw new LoginNotConfiguredError(["BETTER_AUTH_SECRET"]);
    const baseURL = new URL(c.req.url).origin;
    return withDatabase((db) => work(createAuth(db, { secret, baseURL, codeSender }), db));
  }

  const app = new OpenAPIHono({
    defaultHook: (result) => {
      if (!result.success) throw new InvalidRequestError("The request body is not valid.");
    },
  });

  app.openapi(askForCode, (c) =>
    withAuth(c, async (auth, db) => {
      const email = c.req.valid("json").email.toLowerCase();
      await requestLimiter.check(db, LIMITS.codePerIp, clientIp(c));
      await requestLimiter.check(db, LIMITS.codePerAddress, email);
      await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
      return c.json({ sent: true as const }, 200);
    }),
  );

  app.openapi(signIn, (c) =>
    withAuth(c, async (auth, db) => {
      const { email, code, rememberMe } = c.req.valid("json");
      await requestLimiter.check(db, LIMITS.loginPerIp, clientIp(c));
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
      relayCookies(c, result.headers);
      return c.json({ user: toUser(result.response.user) }, 200);
    }),
  );

  app.openapi(readSession, (c) =>
    withAuth(c, async (auth) => {
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
    withAuth(c, async (auth) => {
      const headers = forwardedHeaders(c);
      if (!(await auth.api.getSession({ headers }))) throw new NotSignedInError();
      const result = await auth.api.signOut({ headers, returnHeaders: true });
      relayCookies(c, result.headers);
      return c.json({ signedOut: true as const }, 200);
    }),
  );

  return app;
}
