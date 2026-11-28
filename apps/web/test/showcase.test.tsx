import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { messagesFor } from "../src/i18n/i18n.ts";
import { showcaseShown } from "../src/showcase/showcase-shown.ts";
import { ShowcaseView } from "../src/showcase/showcase-view.tsx";

describe("showcaseShown", () => {
  it.each([
    ["development", true],
    ["preview", true],
    ["production", false],
  ] as const)("in %s is %s", (environment, shown) => {
    expect(showcaseShown(environment)).toBe(shown);
  });
});

const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern, "g"))?.length ?? 0;

describe.each(["en", "es"] as const)("the showcase page in %s", (lang) => {
  const messages = messagesFor(lang);
  const html = renderToString(<ShowcaseView messages={messages} />);

  it("has its heading and every piece in every state", () => {
    expect(html).toContain(`<h1>${messages.showcaseHeading}</h1>`);
    // Buttons: main, secondary and text, each normal and disabled, and the form's submit.
    expect(count(html, /<button type="button"/)).toBe(6);
    expect(count(html, /<button type="submit"/)).toBe(1);
    expect(count(html, /<button[^>]*\sdisabled=""/)).toBe(3);
    expect(html).toContain(messages.showcaseText);
    // Text fields: with a hint, plain, with an error, disabled.
    expect(count(html, /<input(?![^>]*type="checkbox")[^>]*>/)).toBe(4);
    expect(count(html, /aria-invalid="true"/)).toBe(1);
    expect(html).toContain(messages.showcaseEmailError);
    // Checkboxes: unticked, ticked, disabled.
    expect(count(html, /<input[^>]*type="checkbox"/)).toBe(3);
    expect(count(html, /<input[^>]*type="checkbox"[^>]*\schecked=""/)).toBe(1);
    expect(count(html, /<input[^>]*type="checkbox"[^>]*\sdisabled=""/)).toBe(1);
    expect(html).toContain(messages.showcaseRemember);
    // The card.
    expect(html).toContain(messages.showcaseCardBody);
  });

  // Every value comes from a token's utility: no arbitrary value (bg-[#fff]),
  // no variable (animate-(--x)) and no number Tailwind turns into a duration
  // with no token (duration-300), in any variant; and no inline style.
  it("takes every value from the tokens", () => {
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list = ""]) =>
      list.split(/\s+/),
    );

    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((name) => /[[(]/.test(name))).toEqual([]);
    expect(classes.filter((name) => /(^|:)(duration|delay)-\d/.test(name))).toEqual([]);
    expect(html).not.toContain("style=");
  });
});
