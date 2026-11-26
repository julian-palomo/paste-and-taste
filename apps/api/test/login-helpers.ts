import { createApp } from "../src/app.ts";
import type { CodeSender } from "../src/login/code-sender.ts";
import type { TestPostgres } from "./postgres.ts";

// A made-up secret: the tests never use a real one.
const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

export const LOGIN_SETTINGS = {
  BETTER_AUTH_SECRET: TEST_SECRET,
  PASSKEY_RP_ID: "localhost",
  PASSKEY_ORIGIN: "http://localhost:5173",
  // These tests sign in new addresses; test/sign-up.test.ts covers "invited".
  SIGN_UP: "open",
};

// Keeps every code it is handed, for the test to read.
export function recordingSender() {
  const sent: { email: string; code: string; language: string }[] = [];
  const sender: CodeSender = {
    send: async (email, code, language) => {
      sent.push({ email, code, language });
    },
  };
  return {
    sender,
    sent,
    lastCodeFor: (email: string) => sent.filter((s) => s.email === email).at(-1)?.code,
  };
}

export function loginApp(
  postgres: TestPostgres,
  sender: CodeSender,
  appEnv: "development" | "preview" | "production" = "development",
) {
  return createApp(
    { APP_ENV: appEnv, ...LOGIN_SETTINGS },
    { connectionString: () => postgres.connectionString },
    { codeSender: sender },
  );
}

// Every Set-Cookie of a response, by name.
export function setCookies(response: Response): Map<string, string> {
  const byName = new Map<string, string>();
  for (const cookie of response.headers.getSetCookie()) {
    byName.set(cookie.slice(0, cookie.indexOf("=")), cookie);
  }
  return byName;
}

// The Cookie header a browser would send back after these responses.
export function cookieHeader(...responses: Response[]): string {
  const values = new Map<string, string>();
  for (const response of responses) {
    for (const [name, cookie] of setCookies(response)) {
      values.set(name, cookie.slice(0, cookie.indexOf(";")));
    }
  }
  return [...values.values()].join("; ");
}

export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}
