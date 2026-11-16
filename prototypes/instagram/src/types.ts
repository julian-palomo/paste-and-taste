// The shapes the measuring script and the scratch Worker share. A Measurement
// holds no text from a post, only statuses, booleans, counts and a time, so
// nothing that prints or returns one can leak a link, a handle or a caption.

/** `unknown` is a post the owner couldn't sort; its totals stay apart instead of being guessed. */
export type Kind = "reel-own-audio" | "reel-music" | "carousel" | "image" | "unknown";

export const KINDS: readonly Kind[] = [
  "reel-own-audio",
  "reel-music",
  "carousel",
  "image",
  "unknown",
];

/** Where a post's recipe is, as the owner marked it by watching the post. */
export type Place = "caption" | "speech" | "frames" | "carousel" | "nowhere";

export const PLACES: readonly Place[] = ["caption", "speech", "frames", "carousel", "nowhere"];

/** `number` is the post's line number in the sample file; `place` is null on a line without one. */
export type Post = {
  number: number;
  url: string;
  kind: Kind;
  images: number | null;
  place: Place | null;
};

export type RouteName = "embed" | "oembed" | "page";

export const ROUTES: readonly RouteName[] = ["embed", "oembed", "page"];

export type Outcome =
  | "ok"
  | "login-redirect"
  | "rate-limited"
  | "blocked"
  | "not-found"
  | "private"
  | "missing-field"
  | "error"
  | "stopped";

export type Measurement = {
  route: RouteName;
  status: number | null;
  outcome: Outcome;
  caption: boolean;
  video: boolean;
  images: number | null;
  ms: number;
};

/** What a route reads from one answer; the rest of a Measurement is filled in around it. */
export type Reading = Pick<Measurement, "outcome" | "caption" | "video" | "images">;

export function nothing(outcome: Outcome): Reading {
  return { outcome, caption: false, video: false, images: null };
}
