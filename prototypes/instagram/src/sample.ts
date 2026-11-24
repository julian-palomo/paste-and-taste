// Reads the owner's sample file, which lives outside the repo. One post per
// line: `<link> <kind>`, or `<link> carousel <number of images>`, optionally
// followed by where the recipe is; blank lines and lines starting with # are
// skipped. Errors name the line number and never
// quote the line, which holds a link.

import { readFile } from "node:fs/promises";
import { parsePostLink } from "./links.ts";
import { KINDS, type Kind, PLACES, type Place, type Post } from "./types.ts";

function isKind(value: string | undefined): value is Kind {
  return KINDS.some((kind) => kind === value);
}

function isPlace(value: string | undefined): value is Place {
  return PLACES.some((place) => place === value);
}

function parseSample(text: string): Post[] {
  const posts: Post[] = [];
  for (const [index, raw] of text.split("\n").entries()) {
    const number = index + 1;
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const [url = "", kind, ...rest] = line.split(/\s+/);
    if (!parsePostLink(url)) throw new Error(`line ${number}: the first field is not a post link`);
    if (!isKind(kind)) {
      throw new Error(`line ${number}: the kind must be one of ${KINDS.join(", ")}`);
    }

    let images: number | null = null;
    if (kind === "carousel") {
      images = Number(rest.shift());
      if (!Number.isInteger(images) || images < 1) {
        throw new Error(`line ${number}: a carousel needs its number of images`);
      }
    }
    const place = rest.shift();
    if (place !== undefined && !isPlace(place)) {
      throw new Error(`line ${number}: the place must be one of ${PLACES.join(", ")}`);
    }
    if (rest.length > 0) throw new Error(`line ${number}: too many fields`);
    posts.push({ number, url, kind, images, place: place ?? null });
  }
  return posts;
}

export async function readSample(path: string): Promise<Post[]> {
  return parseSample(await readFile(path, "utf8"));
}
