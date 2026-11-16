// Reads the owner's sample file, which lives outside the repo. One post per
// line: `<link> <kind>`, or `<link> carousel <number of images>`; blank lines
// and lines starting with # are skipped. Errors name the line number and never
// quote the line, which holds a link.

import { readFile } from "node:fs/promises";
import { parsePostLink } from "./links.ts";
import { KINDS, type Kind, type Post } from "./types.ts";

function isKind(value: string | undefined): value is Kind {
  return KINDS.some((kind) => kind === value);
}

function parseSample(text: string): Post[] {
  const posts: Post[] = [];
  for (const [index, raw] of text.split("\n").entries()) {
    const number = index + 1;
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const [url = "", kind, count, ...rest] = line.split(/\s+/);
    if (!parsePostLink(url)) throw new Error(`line ${number}: the first field is not a post link`);
    if (!isKind(kind)) {
      throw new Error(`line ${number}: the kind must be one of ${KINDS.join(", ")}`);
    }
    if (rest.length > 0) throw new Error(`line ${number}: too many fields`);

    if (kind === "carousel") {
      const images = Number(count);
      if (!Number.isInteger(images) || images < 1) {
        throw new Error(`line ${number}: a carousel needs its number of images`);
      }
      posts.push({ number, url, kind, images });
    } else {
      if (count !== undefined) throw new Error(`line ${number}: only a carousel takes a number`);
      posts.push({ number, url, kind, images: null });
    }
  }
  return posts;
}

export async function readSample(path: string): Promise<Post[]> {
  return parseSample(await readFile(path, "utf8"));
}
