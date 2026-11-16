// The outcome any route gives an answer before reading it. Route-specific
// answers (oEmbed's private post, the embed view's "may be broken" page) are
// judged in the route.

import type { Answer } from "./http.ts";
import type { Outcome } from "./types.ts";

/** Returns null for a 2xx answer, which the route then reads. */
export function failureOf(answer: Answer): Outcome | null {
  if (answer.loginRedirect) return "login-redirect";
  if (answer.status >= 200 && answer.status < 300) return null;
  if (answer.status === 429) return "rate-limited";
  if (answer.status === 404) return "not-found";
  return "blocked";
}
