import { type AppConfig, ConfigError } from "../config/config.schema.ts";
import { createResendCodeSender } from "./resend-code-sender.ts";

// How a sign-in code reaches the person who asked for it. The rest of the
// login knows only this type, so sending real email is one more sender.
export type Language = "es" | "en";

export type CodeSender = { send(email: string, code: string, language: Language): Promise<void> };

// Development only: prints the address and the code in the API's terminal, so
// signing in locally needs no email service.
export const consoleCodeSender: CodeSender = {
  send: async (email, code) => {
    console.log(`Sign-in code for ${email}: ${code}`);
  },
};

// Which sender runs where. With Resend's key, the code goes by email. Without
// it, development prints it, so a local run needs no account; preview and
// production refuse to start, naming the key, rather than answer "sent" to
// nobody. createApp runs when the Worker starts, so that is where it fails.
export function chooseCodeSender(
  config: Pick<AppConfig, "APP_ENV" | "RESEND_API_KEY">,
  fetch?: (request: Request) => Promise<Response>,
): CodeSender {
  if (config.RESEND_API_KEY) {
    return createResendCodeSender({ apiKey: config.RESEND_API_KEY, ...(fetch ? { fetch } : {}) });
  }
  if (config.APP_ENV === "development") return consoleCodeSender;
  throw new ConfigError(
    `RESEND_API_KEY is required in ${config.APP_ENV} to send the sign-in code by email.`,
  );
}
