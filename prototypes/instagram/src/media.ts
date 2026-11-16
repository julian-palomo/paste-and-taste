// Finds a post's data in an HTML page and reads what the measurement needs.
// Instagram's pages carry the data as JSON in <script> tags, sometimes as JSON
// inside a JSON string, in shapes that change without notice; so this parses
// every blob it can and walks it for the object whose code is the post's,
// instead of trusting one path.

type Found = { caption: boolean; video: boolean; images: number | null };

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function at(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === "number") current = Array.isArray(current) ? current[key] : undefined;
    else current = isRecord(current) ? current[key] : undefined;
  }
  return current;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function* blobs(html: string): Generator<unknown> {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = match[1]?.trim();
    if (body?.startsWith("{") || body?.startsWith("[")) yield parse(body);
  }
  // The embed view keeps its data in a JSON string under "contextJSON",
  // inside a script that isn't JSON itself.
  for (const match of html.matchAll(/"contextJSON":("(?:[^"\\]|\\.)*")/g)) {
    const inner = match[1] ? parse(match[1]) : undefined;
    if (typeof inner === "string") yield parse(inner);
  }
}

/**
 * Keys only a media object carries. The post's code also appears in stubs,
 * such as the embed view's `context` and the page's route parameters, which
 * come before the media object; matching on the code alone reads a stub and
 * reports a post with no caption and no video.
 */
const MEDIA_KEYS = [
  "display_url",
  "image_versions2",
  "video_url",
  "video_versions",
  "is_video",
  "media_type",
  "edge_media_to_caption",
];

/** Depth-first search for the media object whose code is `code`; strings holding JSON are opened. */
function findObject(value: unknown, code: string, depth = 0): Json | null {
  if (depth > 60) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text.startsWith("{") ? findObject(parse(text), code, depth + 1) : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObject(item, code, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if ((value.shortcode === code || value.code === code) && MEDIA_KEYS.some((key) => key in value)) {
    return value;
  }
  for (const item of Object.values(value)) {
    const found = findObject(item, code, depth + 1);
    if (found) return found;
  }
  return null;
}

function hasImage(item: unknown): boolean {
  if (nonEmptyString(at(item, "display_url"))) return true;
  const candidates = at(item, "image_versions2", "candidates");
  return Array.isArray(candidates) && candidates.length > 0;
}

function hasVideo(item: unknown): boolean {
  if (nonEmptyString(at(item, "video_url"))) return true;
  const versions = at(item, "video_versions");
  return Array.isArray(versions) && versions.length > 0;
}

/** The two shapes seen in Instagram's pages: the GraphQL one and the private API's. */
function read(media: Json): Found {
  const caption =
    nonEmptyString(at(media, "edge_media_to_caption", "edges", 0, "node", "text")) ||
    nonEmptyString(at(media, "caption", "text"));

  const sidecar = at(media, "edge_sidecar_to_children", "edges");
  const carousel = at(media, "carousel_media");
  let images: number | null = null;
  if (Array.isArray(sidecar)) {
    images = sidecar.filter((edge) => hasImage(at(edge, "node"))).length;
  } else if (Array.isArray(carousel)) {
    images = carousel.filter(hasImage).length;
  } else if (!hasVideo(media) && media.is_video !== true && hasImage(media)) {
    images = 1;
  }

  return { caption, video: hasVideo(media), images };
}

export function findPost(html: string, code: string): Found | null {
  for (const blob of blobs(html)) {
    const media = findObject(blob, code);
    if (media) return read(media);
  }
  return null;
}
