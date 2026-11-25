import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildingView } from "../src/home/building-view.tsx";
import { homeOf } from "../src/home/home-of.ts";
import { messagesFor } from "../src/i18n/i18n.ts";

it.each([
  ["development", "health"],
  ["preview", "health"],
  ["production", "building"],
] as const)("in %s, the home is the %s page", (environment, home) => {
  expect(homeOf(environment)).toBe(home);
});

describe.each(["en", "es"] as const)("the building page in %s", (lang) => {
  const messages = messagesFor(lang);
  const html = renderToString(<BuildingView messages={messages} />);
  // Text as renderToString writes it.
  const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

  it("says what the app is and that it is being built", () => {
    expect(html).toContain(`<h1>${escaped(messages.buildingHeading)}</h1>`);
    expect(html).toContain(escaped(messages.buildingAbout));
    expect(html).toContain(escaped(messages.buildingNotOpen));
  });

  // Nothing about a visitor is asked for, stored or sent.
  it("has no form, no input, no script and no other site", () => {
    expect(html).not.toMatch(/<form|<input|<script|https?:\/\//);
  });

  it("takes every value from the tokens", () => {
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list = ""]) =>
      list.split(/\s+/),
    );
    expect(classes.filter((name) => /[[(]/.test(name))).toEqual([]);
    expect(html).not.toContain("style=");
  });
});
