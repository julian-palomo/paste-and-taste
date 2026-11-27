import { eq } from "drizzle-orm";
import type { Database } from "../database/database.ts";
import { invitedAddress } from "../database/schema.ts";

// The invited list. Every address goes in and is looked up in lower case,
// as the login routes compare them.

export async function isInvited(db: Database, email: string): Promise<boolean> {
  const rows = await db
    .select({ email: invitedAddress.email })
    .from(invitedAddress)
    .where(eq(invitedAddress.email, email.toLowerCase()));
  return rows.length > 0;
}

// Inviting an address twice changes nothing.
export async function invite(db: Database, email: string): Promise<void> {
  await db.insert(invitedAddress).values({ email: email.toLowerCase() }).onConflictDoNothing();
}

// true when the address was on the list.
export async function uninvite(db: Database, email: string): Promise<boolean> {
  const rows = await db
    .delete(invitedAddress)
    .where(eq(invitedAddress.email, email.toLowerCase()))
    .returning({ email: invitedAddress.email });
  return rows.length > 0;
}
