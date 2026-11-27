import { useId } from "react";

// A text field with its label always above it, never a placeholder in its
// place. The hint and the error sit under it. aria-describedby names, in this
// order, describedBy (an element outside the field, such as a notice), the
// hint and the error, so a screen reader reads them out with the field. useId
// gives the same ids on the server and in the browser. React writes autoFocus
// into the server's HTML as autofocus, so a field given the focus has it
// before any JavaScript runs.
export function TextField({
  label,
  name,
  type,
  hint,
  error,
  autoComplete,
  inputMode,
  defaultValue,
  required,
  disabled,
  autoFocus,
  maxLength,
  describedBy,
}: {
  label: string;
  name: string;
  type: "text" | "email";
  hint?: string | undefined;
  error?: string | undefined;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric";
  defaultValue?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  describedBy?: string | undefined;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [describedBy, hint && hintId, error && errorId].filter(Boolean).join(" ");
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="font-bold text-body">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: a field is given the focus only after its form was sent, when it has an error or a notice to read out, so a screen reader reads the field with it.
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className="h-control w-full rounded-control border-2 border-border-control bg-surface-raised px-5 text-body text-text aria-invalid:border-danger disabled:cursor-not-allowed disabled:border-dashed disabled:text-text-muted"
      />
      {hint && (
        <p id={hintId} className="text-small text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
