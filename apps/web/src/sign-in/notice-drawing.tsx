// The envelope with a tick on a round badge, for the notice that another code
// went out (DESIGN.md section 6; the reference is
// docs/design/states/envelope-sent.svg). The envelope's creams are the
// drawing's own colours; the badge and its tick take the accent from the
// tokens, so they follow light and dark. It hops once when the page arrives,
// after the card, and the tick draws once the envelope is still; the tick's
// path needs pathLength="1" and strokeDasharray 1 for draw. Hidden from screen
// readers: the words beside it say the same.
export function EnvelopeSent() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 120" className="size-11.5 shrink-0 animate-hop">
      <rect x="10" y="30" width="92" height="66" rx="12" fill="#FFF3CF" />
      <path d="M56 30h34a12 12 0 0 1 12 12v42a12 12 0 0 1-12 12H56z" fill="#F4E2A6" />
      <path
        d="M16 38l40 30 40-30"
        fill="none"
        stroke="#C9A24A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="28" cy="46" rx="8" ry="4" fill="#FFFBEA" transform="rotate(-20 28 46)" />
      <circle cx="94" cy="34" r="20" className="fill-accent" />
      <path
        d="M85 34.5l6.5 6.5 11.5-13.5"
        fill="none"
        className="stroke-on-accent animate-draw-late"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
      />
    </svg>
  );
}
