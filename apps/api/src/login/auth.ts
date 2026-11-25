import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import type { Database } from "../database/database.ts";
import { authAccount, passkey, session, user, verification } from "../database/schema.ts";
import type { Outbox } from "./outbox.ts";
import { rememberMeHook } from "./remember-me.ts";

const DAY_SECONDS = 24 * 60 * 60;

// The adapter finds a model as schema[modelName], so the renamed account
// model is under its table's name.
const AUTH_SCHEMA = { user, session, verification, passkey, auth_account: authAccount };

export type AuthSettings = {
  secret: string;
  baseURL: string;
  passkeyRpId: string;
  passkeyOrigin: string;
  outbox: Outbox;
};

// One Better Auth instance for one request. Never hoist it to module scope or
// share it: it holds the request's database client, and a client shared
// between requests leaves the next ones hung on Workers
// (docs/adr/2026-11-25-database-host-and-drizzle.md).
export function createAuth(db: Database, settings: AuthSettings) {
  return betterAuth({
    baseURL: settings.baseURL,
    secret: settings.secret,
    database: drizzleAdapter(db, { provider: "pg", schema: AUTH_SCHEMA }),
    account: { modelName: "auth_account" },
    // Ticked "Mantener la sesión iniciada": 90 days from the last use, renewed
    // when used more than a day after the last renewal
    // (docs/adr/2026-11-25-a-remembered-session-lasts-90-days.md).
    session: { expiresIn: 90 * DAY_SECONDS, updateAge: DAY_SECONDS },
    hooks: { after: rememberMeHook },
    // The app's own limiter replaces this one: auth.api calls skip it anyway.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    plugins: [
      emailOTP({
        // Better Auth's defaults, written out so an upgrade can't change them.
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        // Encrypted with the secret. "hashed" is an unsalted SHA-256, which
        // anyone who reads the row reverses by trying the 10^6 codes.
        storeOTP: "encrypted",
        // Only kept for the route to send: see outbox.ts for why.
        sendVerificationOTP: async ({ email, otp }) => {
          settings.outbox.put(email, otp);
        },
      }),
      // The passkey belongs to rpID; the browser runs the ceremony on the web
      // app's page, so that page's address is the origin, not the API's.
      passkeyPlugin({
        rpID: settings.passkeyRpId,
        rpName: "Paste & Taste",
        origin: settings.passkeyOrigin,
      }),
    ],
  });
}
