// Reads a post's caption and media addresses through the public embed view.
// What it returns is other people's content: it stays in memory and is never
// printed, logged or written into the repo.

import { get } from "./http.ts";
import type { PostLink } from "./links.ts";
import { at, findMedia, type Json } from "./media.ts";
import { failureOf } from "./outcome.ts";
import type { Outcome } from "./types.ts";

type PostContent = { caption: string; video: string | null; images: string[] };

export type PostRead = { ok: true; content: PostContent } | { ok: false; outcome: Outcome };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The address of an item's largest image, in either of the two shapes. */
function imageOf(item: unknown): string | null {
  const display = text(at(item, "display_url"));
  if (display) return display;
  return text(at(item, "image_versions2", "candidates", 0, "url")) || null;
}

function videoOf(media: Json): string | null {
  const url = text(at(media, "video_url"));
  if (url) return url;
  return text(at(media, "video_versions", 0, "url")) || null;
}

function contentOf(media: Json): PostContent {
  const caption =
    text(at(media, "edge_media_to_caption", "edges", 0, "node", "text")) ||
    text(at(media, "caption", "text"));

  const sidecar = at(media, "edge_sidecar_to_children", "edges");
  const carousel = at(media, "carousel_media");
  let images: string[] = [];
  if (Array.isArray(sidecar)) {
    images = sidecar.map((edge) => imageOf(at(edge, "node"))).filter((url) => url !== null);
  } else if (Array.isArray(carousel)) {
    images = carousel.map(imageOf).filter((url) => url !== null);
  } else if (!videoOf(media) && media.is_video !== true) {
    // A single image: its one address. A reel's display image is its cover, not content.
    const single = imageOf(media);
    if (single) images = [single];
  }

  return { caption, video: videoOf(media), images };
}

export async function readPost(link: PostLink): Promise<PostRead> {
  const answer = await get(`https://www.instagram.com/p/${link.code}/embed/captioned/`);
  const failure = failureOf(answer);
  if (failure) return { ok: false, outcome: failure };
  const media = findMedia(answer.body, link.code);
  if (!media) {
    return {
      ok: false,
      outcome: /may be broken/i.test(answer.body) ? "not-found" : "missing-field",
    };
  }
  return { ok: true, content: contentOf(media) };
}
