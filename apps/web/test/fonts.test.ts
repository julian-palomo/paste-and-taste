import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fontPreloads } from "../src/styles/fonts.ts";

const css = readFileSync(new URL("../src/styles/fonts.css", import.meta.url), "utf8");
const fileName = (path: string) => path.split("/").pop()?.split("?")[0];

// The files the first paint needs are fetched with the stylesheet, not after
// it, and each one is the file an @font-face rule uses, so it downloads once.
it("preloads each font file the stylesheet uses, and nothing else", () => {
  const used = [...css.matchAll(/url\("([^"]+)"\)/g)].map(([, path = ""]) => fileName(path));
  expect(used).toHaveLength(2);
  expect(fontPreloads.map((link) => fileName(link.href)).sort()).toEqual(used.sort());
  for (const link of fontPreloads) {
    expect(link).toMatchObject({
      rel: "preload",
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    });
  }
});

// optional: a typeface that misses the first paint is never swapped in.
it("never swaps a typeface in after the page is drawn", () => {
  const rules = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  expect(rules).toHaveLength(2);
  for (const rule of rules) expect(rule).toMatch(/font-display:\s*optional;/);
});
