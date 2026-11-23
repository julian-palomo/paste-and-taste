import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The colours as tokens.css declares them, by name: "text" for --color-text.
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const colors = new Map(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, name, hex]) => [
    name,
    hex,
  ]),
);

function color(name: string): string {
  const hex = colors.get(name);
  if (!hex) throw new Error(`tokens.css declares no --color-${name} as #rrggbb`);
  return hex;
}

// WCAG 2's relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(color(foreground)), luminance(color(background))].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("the colour tokens", () => {
  // Every text a page writes, on every background it writes it on.
  it.each([
    ["text", "surface"],
    ["text-muted", "surface"],
    ["accent", "surface"],
    ["danger", "surface"],
    ["text", "surface-raised"],
    ["text-muted", "surface-raised"],
    ["on-accent", "accent"],
  ])("%s on %s reaches 4.5:1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  // The focus ring is not text: WCAG asks 3:1 against what is next to it.
  it("the focus ring reaches 3:1 on the surface", () => {
    expect(contrast("focus", "surface")).toBeGreaterThanOrEqual(3);
  });
});
