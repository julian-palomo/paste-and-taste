import type { Database, WithDatabase } from "../database/database.ts";
import { createAuth } from "./auth.ts";
import { LoginNotConfiguredError } from "./login-errors.ts";
import { createOutbox, type Outbox } from "./outbox.ts";

export type Auth = ReturnType<typeof createAuth>;

type LoginSettings = {
  secret?: string | undefined;
  passkeyRpId?: string | undefined;
  passkeyOrigin?: string | undefined;
};

// Runs `work` with one Better Auth instance and one database client for this
// request, both gone when it ends, and the request's outbox for a sign-in
// code. Everything that reaches Better Auth goes through it.
export type WithAuth = <T>(
  request: Request,
  work: (auth: Auth, db: Database, outbox: Outbox) => Promise<T>,
) => Promise<T>;

type WithAuthDeps = { withDatabase: WithDatabase; settings: LoginSettings };

export function createWithAuth({ withDatabase, settings }: WithAuthDeps): WithAuth {
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
    const outbox = createOutbox();
    return withDatabase((db) =>
      work(createAuth(db, { secret, baseURL, passkeyRpId, passkeyOrigin, outbox }), db, outbox),
    );
  };
}
