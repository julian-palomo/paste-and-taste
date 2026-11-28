import type { ReactNode } from "react";

// A pill with a fill loses the fill when disabled and gets a dashed outline:
// its shape changes, not only its colour.
const filled =
  "h-control rounded-control px-6 disabled:border-2 disabled:border-dashed disabled:border-border-control disabled:bg-transparent";

const kinds = {
  main: `${filled} bg-accent text-on-accent enabled:hover:bg-text`,
  secondary: `${filled} bg-chip text-text enabled:hover:bg-accent-middle`,
  // An action beside the main one: underlined accent text with no fill and no
  // border, still a touch target. Disabled, it loses the underline.
  text: "min-h-touch px-3 text-accent underline underline-offset-4 enabled:hover:text-text disabled:no-underline",
};

// A button. `type` has no default: HTML's is "submit", so a button written
// without one would submit its form by accident. `wide` makes it as wide as
// its column, for the one main action of a step.
export function Button({
  kind,
  type,
  disabled,
  wide,
  children,
}: {
  kind: keyof typeof kinds;
  type: "submit" | "button";
  disabled?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-bold text-body transition-colors ${kinds[kind]}${wide ? " w-full" : ""} enabled:cursor-pointer disabled:cursor-not-allowed disabled:text-text-muted`}
    >
      {children}
    </button>
  );
}
