// Usage: pnpm -C apps/api openapi          writes openapi.json
//        pnpm -C apps/api openapi:check    exits 1 if openapi.json is stale
// Runs in Node, never in the Worker.
import { readFileSync, writeFileSync } from "node:fs";
import { createApp, noDatabase } from "../src/app.ts";
import { openApiDocument } from "../src/openapi.ts";

const FILE = new URL("../openapi.json", import.meta.url);
const NAME = "apps/api/openapi.json";

// The document depends on neither the variables nor the database; createApp
// needs valid variables, and the script never connects.
const document = openApiDocument(createApp({ APP_ENV: "development" }, noDatabase));
const text = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let committed = "";
  try {
    committed = readFileSync(FILE, "utf8");
  } catch {}
  if (committed !== text) {
    console.error(`FAIL ${NAME} is out of date: run pnpm -C apps/api openapi and commit it.`);
    process.exit(1);
  }
  console.log(`OK ${NAME} is up to date`);
} else {
  writeFileSync(FILE, text);
  console.log(`Wrote ${NAME}`);
}
