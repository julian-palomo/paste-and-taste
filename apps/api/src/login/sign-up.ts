import { eq } from "drizzle-orm";
import type { Database } from "../database/database.ts";
import { user } from "../database/schema.ts";
import { isInvited } from "./invited-address.repository.ts";

// Who may get a sign-in code: anyone, or until launch only an invited address
// or one that already has an account
// (docs/adr/2026-11-26-sign-up-by-invitation.md).
export type SignUp = "invited" | "open";

export async function mayGetCode(db: Database, signUp: SignUp, email: string): Promise<boolean> {
  if (signUp === "open") return true;
  return (await hasAccount(db, email)) || (await isInvited(db, email));
}

async function hasAccount(db: Database, email: string): Promise<boolean> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return rows.length > 0;
}
