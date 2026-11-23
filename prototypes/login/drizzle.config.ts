// `pnpm generate` writes the migration from the schema with no database;
// `pnpm migrate` applies it to the database DATABASE_URL names. The URL comes
// only from the environment: never write one into this file.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
