// A native checkbox, so it works with the keyboard and is sent with its form
// with no JavaScript. The input itself is the box the person sees; the label
// wraps it and its text, so the whole row, at least min-h-touch tall, is the
// touch target. Ticking it bounces the box and draws the tick; a box rendered
// already ticked plays both once when the page loads.
//
// The tick is drawn by animating stroke-dashoffset from 1 to 0, which needs
// pathLength="1" and strokeDasharray 1 on the path; the svg's
// stroke-dashoffset reaches the path because the property is inherited. The
// svg must come right after the input: peer-checked reads its sibling.
//
// Don't remove the forced-colors: classes. With forced colours (Windows high
// contrast) the drawn box loses its fill and the tick keeps its own colour,
// so a ticked box can look unticked; there the browser draws its own
// checkbox in the system's colours, and the tick is hidden.
export function Checkbox({
  label,
  name,
  value,
  defaultChecked,
  disabled,
}: {
  label: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 text-body has-disabled:cursor-not-allowed has-disabled:text-text-muted">
      <span className="relative flex shrink-0">
        <input
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer size-6 cursor-pointer appearance-none forced-colors:appearance-auto rounded-checkbox border-2 border-border-control bg-surface-raised checked:animate-bounce checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:border-dashed"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none invisible absolute inset-0 size-6 text-on-accent peer-checked:visible peer-checked:animate-draw forced-colors:hidden"
        >
          <path d="M6 12.5l4 4 8-9" pathLength={1} strokeDasharray={1} />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}
