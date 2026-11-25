// `pnpm -C apps/api db:generate` writes the migrations from the schema, with
// no database. `pnpm -C apps/api db:migrate` applies them to the database
// DATABASE_URL names; only the owner runs it. The URL comes only from the
// environment: never write one into this file.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
