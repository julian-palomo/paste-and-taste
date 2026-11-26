// Usage: pnpm -C apps/api invite add|remove
// Adds an address to the invited list, or removes it, in the database
// DATABASE_URL names (docs/deploying-the-api.md). The address is asked for on
// the terminal, never passed as an argument, so it stays out of the shell's
// history; nothing printed holds it. Only the owner runs it.
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { inviteCommand } from "../src/login/invite-command.ts";

const action = process.argv[2] ?? "";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set: see docs/deploying-the-api.md.");
  process.exit(1);
}

const terminal = createInterface({ input: stdin, output: stdout });
const address = await terminal.question("Email address: ");
terminal.close();

const client = new Client({ connectionString });
try {
  await client.connect();
  console.log(await inviteCommand(drizzle(client), action, address));
} catch (error) {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exitCode = 1;
} finally {
  await client.end();
}
