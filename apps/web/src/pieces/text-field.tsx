import { useId } from "react";

// A text field with its label always above it, never a placeholder in its
// place. The hint and the error sit under it, and aria-describedby names
// them, hint first, so a screen reader reads them out with the field. useId
// gives the same ids on the server and in the browser.
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
}: {
  label: string;
  name: string;
  type: "text" | "email";
  hint?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric";
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint && hintId, error && errorId].filter(Boolean).join(" ");
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
