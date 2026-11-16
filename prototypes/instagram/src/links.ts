// Turns a shared link into the post's code. Every address a route requests is
// built from the code, never copied from the sample, so tracking parameters
// in a shared link don't reach Instagram and no post link is ever a literal.

export type PostLink = { type: "p" | "reel"; code: string };

const POST_LINK = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/;

export function parsePostLink(url: string): PostLink | null {
  const match = POST_LINK.exec(url.trim());
  if (!match?.[1] || !match[2]) return null;
  return { type: match[1].startsWith("reel") ? "reel" : "p", code: match[2] };
}

export function canonicalUrl(link: PostLink): string {
  return `https://www.instagram.com/${link.type}/${link.code}/`;
}
