// One timed GET, the same in Node and in the Workers runtime.

import { failureOf } from "./outcome.ts";
import type { Measurement, Reading, RouteName } from "./types.ts";

/**
 * Sent with every request from both places. Node's fetch sends `node` and the
 * Workers runtime sends none, so without it the two places would differ in
 * more than the network. Deliberately names no browser: never impersonate one.
 */
export const USER_AGENT =
  "paste-and-taste-instagram-spike/1 (+https://github.com/julian-palomo/paste-and-taste)";

/** Redirects to anywhere but the login page are followed, up to this many. */
const MAX_REDIRECTS = 3;

export type Answer = { status: number; body: string; loginRedirect: boolean };

export async function get(address: string): Promise<Answer> {
  let current = address;
  for (let hop = 0; ; hop++) {
    // "manual" returns the 3xx itself, so a redirect to the login page is
    // seen instead of being followed to a 200 login form.
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      if (location.includes("/accounts/login")) {
        return { status: response.status, body: "", loginRedirect: true };
      }
      if (hop === MAX_REDIRECTS) return { status: response.status, body: "", loginRedirect: false };
      current = new URL(location, current).toString();
      continue;
    }
    return { status: response.status, body: await response.text(), loginRedirect: false };
  }
}

/**
 * Requests `address` and lets `read` judge a 2xx answer, or any answer when
 * `readFailures` is set. The time covers the redirects and the whole body.
 */
export async function measure(
  route: RouteName,
  address: string,
  read: (answer: Answer) => Reading,
  readFailures = false,
): Promise<Measurement> {
  const started = Date.now();
  try {
    const answer = await get(address);
    const ms = Date.now() - started;
    const failure = failureOf(answer);
    const reading = failure && !readFailures ? { outcome: failure } : read(answer);
    return {
      route,
      status: answer.status,
      caption: false,
      video: false,
      images: null,
      ...reading,
      ms,
    };
  } catch {
    return {
      route,
      status: null,
      outcome: "error",
      caption: false,
      video: false,
      images: null,
      ms: Date.now() - started,
    };
  }
}
