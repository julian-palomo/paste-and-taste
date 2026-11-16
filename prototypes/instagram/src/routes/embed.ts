// R1: the public embed view of a post.

import { measure } from "../http.ts";
import type { PostLink } from "../links.ts";
import { findPost } from "../media.ts";
import { type Measurement, nothing } from "../types.ts";

export function measureEmbed(link: PostLink): Promise<Measurement> {
  return measure("embed", `https://www.instagram.com/p/${link.code}/embed/captioned/`, (answer) => {
    const found = findPost(answer.body, link.code);
    if (found) return { outcome: "ok", ...found };
    // A removed or private post answers 200 with this page instead of a 404.
    if (/may be broken/i.test(answer.body)) return nothing("not-found");
    return nothing("missing-field");
  });
}
