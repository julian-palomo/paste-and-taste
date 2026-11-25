import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../src/pieces/button.tsx";
import { Checkbox } from "../src/pieces/checkbox.tsx";
import { TextField } from "../src/pieces/text-field.tsx";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The <input> tag in the markup, and one of its attributes.
function inputTag(html: string): string {
  const tag = /<input[^>]*>/.exec(html)?.[0];
  if (!tag) throw new Error("no <input> in the markup");
  return tag;
}
function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

// The text of the element with this id, as a screen reader reads it out.
function textOf(html: string, id: string): string | undefined {
  return new RegExp(`id="${escapeRegExp(id)}"[^>]*>([^<]*)<`).exec(html)?.[1];
}

describe("TextField", () => {
  it("ties its error to the field, so a screen reader announces it with the field", () => {
    const html = renderToString(
      <TextField label="Email address" name="email" type="email" error="Write a valid address." />,
    );
    const input = inputTag(html);

    expect(attribute(input, "aria-invalid")).toBe("true");
    const described = attribute(input, "aria-describedby")?.split(" ") ?? [];
    expect(described.map((id) => textOf(html, id))).toEqual(["Write a valid address."]);
  });

  it("names the hint first and the error after it", () => {
    const html = renderToString(
      <TextField
        label="Email address"
        name="email"
        type="email"
        hint="We send a code to it."
        error="Write a valid address."
      />,
    );
    const described = attribute(inputTag(html), "aria-describedby")?.split(" ") ?? [];

    expect(described.map((id) => textOf(html, id))).toEqual([
      "We send a code to it.",
      "Write a valid address.",
    ]);
  });

  it("without an error, is not invalid and describes itself with its hint only", () => {
    const html = renderToString(
      <TextField label="Code" name="code" type="text" hint="The six digits." />,
    );
    const input = inputTag(html);

    expect(attribute(input, "aria-invalid")).toBeUndefined();
    const described = attribute(input, "aria-describedby")?.split(" ") ?? [];
    expect(described.map((id) => textOf(html, id))).toEqual(["The six digits."]);
  });

  it("takes the focus when asked, in the server's HTML, so it holds with no JavaScript", () => {
    const html = renderToString(
      <TextField label="Code" name="code" type="text" error="Wrong code." autoFocus />,
    );

    expect(attribute(inputTag(html), "autofocus")).toBe("");
  });

  it("is not focused unless asked", () => {
    const html = renderToString(<TextField label="Code" name="code" type="text" />);

    expect(attribute(inputTag(html), "autofocus")).toBeUndefined();
  });

  it("limits its length when asked", () => {
    const html = renderToString(<TextField label="Code" name="code" type="text" maxLength={6} />);

    // /i: React writes the JSX spelling, maxLength; HTML attribute names ignore case.
    expect(inputTag(html)).toMatch(/\smaxlength="6"/i);
  });

  it("has a visible label tied to the field, and no placeholder", () => {
    const html = renderToString(<TextField label="Code" name="code" type="text" />);
    const input = inputTag(html);
    const id = attribute(input, "id") ?? "";

    expect(id).not.toBe("");
    expect(html).toMatch(new RegExp(`<label[^>]*for="${escapeRegExp(id)}"[^>]*>Code</label>`));
    expect(attribute(input, "placeholder")).toBeUndefined();
    expect(attribute(input, "aria-describedby")).toBeUndefined();
  });
});

// A browser sends a form's ticked checkbox as name=value and leaves out an
// unticked or disabled one, with or without JavaScript, so long as the
// checkbox is a native <input type="checkbox"> inside the form.
describe("Checkbox", () => {
  const inForm = (checkbox: ReactNode) => renderToString(<form method="get">{checkbox}</form>);

  it("is a native checkbox with its name and value, inside its label, in the form", () => {
    const html = inForm(<Checkbox label="Keep me signed in" name="remember" value="yes" />);
    const input = inputTag(html);

    expect(html).toMatch(
      /^<form method="get"><label[^>]*>.*<input[^>]*>.*Keep me signed in.*<\/label><\/form>$/,
    );
    expect(attribute(input, "type")).toBe("checkbox");
    expect(attribute(input, "name")).toBe("remember");
    expect(attribute(input, "value")).toBe("yes");
    expect(attribute(input, "checked")).toBeUndefined();
    expect(attribute(input, "disabled")).toBeUndefined();
    expect(html).not.toMatch(/role=|<script|onclick/i);
  });

  it("is ticked when asked, as the browser reads it with no script", () => {
    const html = inForm(<Checkbox label="Keep me signed in" name="remember" defaultChecked />);

    expect(attribute(inputTag(html), "checked")).toBe("");
  });

  // With forced colours (Windows high contrast) the drawn box loses its fill
  // and the tick keeps its own colour, so a ticked box can look unticked:
  // there the browser draws its own checkbox in the system's colours instead.
  it("hands over to the browser's own checkbox with forced colours", () => {
    const html = renderToString(<Checkbox label="Keep me signed in" name="remember" />);
    const classes = (tag: string) => attribute(tag, "class")?.split(/\s+/) ?? [];
    const svg = /<svg[^>]*>/.exec(html)?.[0] ?? "";

    expect(classes(inputTag(html))).toContain("forced-colors:appearance-auto");
    expect(classes(svg)).toContain("forced-colors:hidden");
  });

  it("is disabled as a form control, so the browser leaves it out", () => {
    const html = inForm(<Checkbox label="Keep me signed in" name="remember" disabled />);

    expect(attribute(inputTag(html), "disabled")).toBe("");
  });
});

describe("Button", () => {
  it.each(["submit", "button"] as const)("is a native button of type %s", (type) => {
    const html = renderToString(
      <Button kind="main" type={type}>
        Continue
      </Button>,
    );

    expect(html).toMatch(new RegExp(`^<button type="${type}"[^>]*>Continue</button>$`));
  });

  it("is disabled as a form control", () => {
    const html = renderToString(
      <Button kind="secondary" type="button" disabled>
        Back
      </Button>,
    );

    expect(html).toMatch(/^<button[^>]*\sdisabled=""[^>]*>Back<\/button>$/);
  });
});
