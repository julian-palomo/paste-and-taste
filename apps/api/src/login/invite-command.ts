import { z } from "zod";
import type { Database } from "../database/database.ts";
import { invite, uninvite } from "./invited-address.repository.ts";

// What `pnpm -C apps/api invite add|remove` does, apart from reading the
// terminal (scripts/invite.ts). It returns the line to print, which never
// holds the address: the owner's terminal may be shared or recorded.
export async function inviteCommand(
  db: Database,
  action: string,
  address: string,
): Promise<string> {
  inviteAction(action);
  // The repository stores it in lower case.
  const email = address.trim();
  if (!z.email().safeParse(email).success) throw new Error("That isn't an email address.");

  if (action === "add") {
    await invite(db, email);
    return "Invited.";
  }
  return (await uninvite(db, email)) ? "Removed." : "Not on the list.";
}

// The command's action, or the usage line as an error. The script calls it
// before anything else, so a mistyped action never asks for an address.
export function inviteAction(action: string | undefined): "add" | "remove" {
  if (action === "add" || action === "remove") return action;
  throw new Error("Usage: pnpm -C apps/api invite add|remove");
}
