// R3: the post's own page, read from the JSON in its scripts.

import { measure } from "../http.ts";
import { canonicalUrl, type PostLink } from "../links.ts";
import { findPost } from "../media.ts";
import { type Measurement, nothing } from "../types.ts";

export function measurePage(link: PostLink): Promise<Measurement> {
  return measure("page", canonicalUrl(link), (answer) => {
    const found = findPost(answer.body, link.code);
    return found ? { outcome: "ok", ...found } : nothing("missing-field");
  });
}
