import { AppError } from "../errors/app-error.ts";

// The login's own errors. Each message is the response's `detail`, so it is
// safe for a client to read.

// The same answer for a wrong, an expired and a used-up code, so the answer
// never tells which.
export class InvalidCodeError extends AppError {
  readonly type = "about:blank";
  readonly title = "Unauthorized";
  readonly status = 401;

  constructor() {
    super("The code is wrong or no longer valid.");
  }
}

export class NotSignedInError extends AppError {
  readonly type = "about:blank";
  readonly title = "Unauthorized";
  readonly status = 401;

  constructor() {
    super("There is no session.");
  }
}

export class TooManyRequestsError extends AppError {
  readonly type = "about:blank";
  readonly title = "Too Many Requests";
  readonly status = 429;

  constructor() {
    super("Too many requests. Try again later.");
  }
}

// An unknown passkey, a signature that doesn't verify, or a sign-in with no
// challenge first: one answer, which never tells which.
export class PasskeyRefusedError extends AppError {
  readonly type = "about:blank";
  readonly title = "Unauthorized";
  readonly status = 401;

  constructor() {
    super("The passkey was not accepted.");
  }
}

// A registration that didn't verify: a refused or expired challenge, a
// passkey registered before, or a session too old to add one (sign in again).
export class PasskeyNotRegisteredError extends AppError {
  readonly type = "about:blank";
  readonly title = "Bad Request";
  readonly status = 400;

  constructor() {
    super("The passkey could not be registered. Sign in again and retry.");
  }
}

// Names the variables that are missing, never their values.
export class LoginNotConfiguredError extends AppError {
  readonly type = "about:blank";
  readonly title = "Service Unavailable";
  readonly status = 503;

  constructor(missing: string[]) {
    super(`Login is not configured: set ${missing.join(", ")}.`);
  }
}
