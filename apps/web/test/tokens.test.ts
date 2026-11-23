import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

// The text between the braces of the block that starts with `opening`.
function block(opening: string): string {
  const start = css.indexOf(`${opening} {`);
  if (start === -1) throw new Error(`tokens.css has no "${opening} {" block`);
  let depth = 0;
  for (let index = css.indexOf("{", start); index < css.length; index++) {
    if (css[index] === "{") depth++;
    if (css[index] === "}" && --depth === 0) return css.slice(start, index);
  }
  throw new Error(`tokens.css never closes "${opening} {"`);
}

// A block's colours by name: "text" for --color-text.
function colorsIn(text: string) {
  return new Map(
    [...text.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, name, hex]) => [
      name,
      hex,
    ]),
  );
}

const modes = {
  light: colorsIn(block("@theme static")),
  dark: colorsIn(block("@media (prefers-color-scheme: dark)")),
};
type Mode = keyof typeof modes;

function color(mode: Mode, name: string): string {
  const hex = modes[mode].get(name);
  if (!hex) throw new Error(`tokens.css declares no ${mode} --color-${name} as #rrggbb`);
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

function contrast(mode: Mode, foreground: string, background: string): number {
  const [light, dark] = [
    luminance(color(mode, foreground)),
    luminance(color(mode, background)),
  ].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe.each(["light", "dark"] as const)("the %s colour tokens", (mode) => {
  // The pairs DESIGN.md, section 3, says reach 4.5:1, and the error page's
  // button, whose text stays on-accent when it turns to text on hover.
  it.each([
    ["text", "surface"],
    ["text", "surface-raised"],
    ["text-muted", "surface"],
    ["text-muted", "surface-raised"],
    ["accent", "surface"],
    ["accent", "surface-raised"],
    ["on-accent", "accent"],
    ["on-accent", "text"],
    ["text", "accent-soft"],
    ["text", "accent-middle"],
    ["text", "chip"],
    ["on-accent-soft", "accent-soft"],
    ["on-accent-soft", "accent-middle"],
    ["danger", "surface"],
    ["danger", "surface-raised"],
  ])("%s on %s reaches 4.5:1", (foreground, background) => {
    expect(contrast(mode, foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  // Not text: WCAG asks 3:1 against what is next to them.
  it.each([
    ["border-control", "surface"],
    ["border-control", "surface-raised"],
    ["focus", "surface"],
    ["focus", "surface-raised"],
  ])("%s on %s reaches 3:1", (foreground, background) => {
    expect(contrast(mode, foreground, background)).toBeGreaterThanOrEqual(3);
  });
});

it("the dark set declares exactly the colours the light set does", () => {
  expect([...modes.dark.keys()].sort()).toEqual([...modes.light.keys()].sort());
});

// A misspelt family silently falls back to the system's typeface.
it.each(["sans", "display"])("--font-%s names first a family fonts.css declares", (role) => {
  const fonts = readFileSync(new URL("../src/styles/fonts.css", import.meta.url), "utf8");
  const declared = [...fonts.matchAll(/font-family:\s*"([^"]+)"/g)].map(([, family]) => family);
  const first = css.match(new RegExp(`--font-${role}:\\s*"([^"]+)"`))?.[1];
  expect(declared).toContain(first);
});
