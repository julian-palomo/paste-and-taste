import type { ReactNode } from "react";

const kinds = {
  main: "bg-accent text-on-accent enabled:hover:bg-text",
  secondary: "bg-chip text-text enabled:hover:bg-accent-middle",
};

// A pill button. `type` has no default: HTML's is "submit", so a button
// written without one would submit its form by accident. Disabled changes its
// shape, not only its colour: the fill goes and a dashed outline replaces it.
export function Button({
  kind,
  type,
  disabled,
  children,
}: {
  kind: keyof typeof kinds;
  type: "submit" | "button";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex h-control items-center justify-center rounded-control px-6 font-bold text-body transition-colors ${kinds[kind]} disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-border-control disabled:bg-transparent disabled:text-text-muted`}
    >
      {children}
    </button>
  );
}
