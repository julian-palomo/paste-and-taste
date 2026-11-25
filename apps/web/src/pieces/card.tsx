import type { ReactNode } from "react";

// A raised surface with the 2px line under it, the only shadow a card has.
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border-b-2 border-border bg-surface-raised p-5">{children}</div>
  );
}
