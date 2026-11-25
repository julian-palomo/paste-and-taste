import type { Database, WithDatabase } from "../database/database.ts";
import { createAuth } from "./auth.ts";
import type { CodeSender } from "./code-sender.ts";
import { LoginNotConfiguredError } from "./login-errors.ts";

export type Auth = ReturnType<typeof createAuth>;

type LoginSettings = {
  secret?: string | undefined;
  passkeyRpId?: string | undefined;
  passkeyOrigin?: string | undefined;
};

// Runs `work` with one Better Auth instance and one database client for this
// request, both gone when it ends. Everything that reaches Better Auth goes
// through it.
export type WithAuth = <T>(
  request: Request,
  work: (auth: Auth, db: Database) => Promise<T>,
) => Promise<T>;

type WithAuthDeps = {
  withDatabase: WithDatabase;
  codeSender: CodeSender;
  settings: LoginSettings;
};

export function createWithAuth({ withDatabase, codeSender, settings }: WithAuthDeps): WithAuth {
  return (request, work) => {
    const { secret, passkeyRpId, passkeyOrigin } = settings;
    if (!secret || !passkeyRpId || !passkeyOrigin) {
      const missing = [
        secret ? "" : "BETTER_AUTH_SECRET",
        passkeyRpId ? "" : "PASSKEY_RP_ID",
        passkeyOrigin ? "" : "PASSKEY_ORIGIN",
      ].filter(Boolean);
      throw new LoginNotConfiguredError(missing);
    }
    const baseURL = new URL(request.url).origin;
    return withDatabase((db) =>
      work(createAuth(db, { secret, baseURL, passkeyRpId, passkeyOrigin, codeSender }), db),
    );
  };
}
