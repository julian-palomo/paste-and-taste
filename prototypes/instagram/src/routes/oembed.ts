// R2: Meta's oEmbed endpoint, called with no access token. Its answer is the
// embed HTML and nothing else of the post: no video address, no image address.

import { measure } from "../http.ts";
import { canonicalUrl, type PostLink } from "../links.ts";
import { failureOf } from "../outcome.ts";
import { type Measurement, nothing } from "../types.ts";

/** Meta's error_subcode for "Private Media". */
const PRIVATE_MEDIA = 2207046;

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Whether the embed HTML holds a caption: any visible text, in whatever tag,
 * besides the "View this post on Instagram" link and the "shared by" credit.
 */
function hasCaption(html: string): boolean {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/g, "")
    .split(/<[^>]*>/)
    .map((text) => text.trim())
    .some((text) => text.length > 0 && !/view this post on instagram|shared by/i.test(text));
}

export function measureOembed(link: PostLink): Promise<Measurement> {
  const address = `https://graph.facebook.com/v27.0/instagram_oembed?url=${encodeURIComponent(canonicalUrl(link))}`;
  return measure(
    "oembed",
    address,
    (answer) => {
      const json = parse(answer.body);
      if (answer.status === 400 && field(field(json, "error"), "error_subcode") === PRIVATE_MEDIA) {
        return nothing("private");
      }
      const failure = failureOf(answer);
      if (failure) return nothing(failure);
      const html = field(json, "html");
      if (typeof html !== "string") return nothing("missing-field");
      return { outcome: "ok", caption: hasCaption(html), video: false, images: null };
    },
    true,
  );
}
