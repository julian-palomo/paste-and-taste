import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// The app's tables. After any change, run `pnpm -C apps/api db:generate` and
// commit the migration it writes to apps/api/drizzle/.

// Better Auth's tables. The keys are Better Auth's field names, which its
// Drizzle adapter maps by key; the columns are snake_case. Keep them in step
// with @better-auth/core's tables and @better-auth/passkey's schema at the
// catalog's version.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

// Better Auth calls this model "account": a way a user signs in. It is named
// auth_account so it never reads as the app's Account (GLOSSARY.md), and it
// is never shown.
export const authAccount = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("auth_account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    index("passkey_credential_id_idx").on(table.credentialID),
  ],
);

// The app's own: how many requests a key made in its current window, for the
// login's limits. A key names the rule and who it counts, e.g.
// "code:email:<address>".
export const requestLimit = pgTable("request_limit", {
  key: text("key").primaryKey(),
  windowStartedAt: timestamp("window_started_at").notNull(),
  count: integer("count").notNull(),
});

// A recipe kept by one user, its copy owner. Ingredients and steps are jsonb:
// always read and written whole, in order, so an edit is one UPDATE
// (docs/adr/2026-11-25-ingredients-and-steps-as-jsonb.md).
export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Who may change it. Never in an answer (GLOSSARY.md, Copy owner).
    copyOwnerId: text("copy_owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    language: text("language").notNull(),
    servings: text("servings"),
    time: text("time"),
    ingredients: jsonb("ingredients")
      .$type<{ name: string; quantity: string | null; unit: string | null }[]>()
      .notNull(),
    steps: jsonb("steps").$type<string[]>().notNull(),
    source: text("source"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("recipe_copy_owner_id_updated_at_idx").on(table.copyOwnerId, table.updatedAt.desc()),
  ],
);
