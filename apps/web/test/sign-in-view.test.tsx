import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Language, messagesFor } from "../src/i18n/i18n.ts";
import type { SignInErrorKind } from "../src/sign-in/relay.ts";
import type { Session } from "../src/sign-in/sign-in.ts";
import { SignInView } from "../src/sign-in/sign-in-view.tsx";

const actions = {
  sendCode: "/_serverFn/send-code",
  signIn: "/_serverFn/sign-in",
  changeAddress: "/_serverFn/change-address",
  signOut: "/_serverFn/sign-out",
};
const signedOut: Session = { kind: "signed-out" };
const signedIn: Session = {
  kind: "signed-in",
  user: { id: "u1", email: "ana@example.com", name: "Ana" },
};
const sent = { email: "ana@example.com", sentAt: 1 };

function render(
  lang: Language,
  props: {
    session?: Session;
    pending?: { email: string; sentAt?: number };
    error?: SignInErrorKind;
    step?: "passkey" | "passkey-added";
  } = {},
) {
  return renderToString(
    <SignInView
      lang={lang}
      messages={messagesFor(lang)}
      session={props.session ?? signedOut}
      pending={props.pending}
      error={props.error}
      step={props.step}
      actions={actions}
      passkeySignIn={null}
      passkeyRegister={null}
    />,
  );
}

const inputs = (html: string) => [...html.matchAll(/<input[^>]*>/g)].map(([tag]) => tag);
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textOf = (html: string, id: string) =>
  new RegExp(`id="${escapeRegExp(id)}"[^>]*>([^<]*)<`).exec(html)?.[1];
// Text as renderToString writes it.
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

const errorText = (lang: Language, kind: SignInErrorKind) => {
  const m = messagesFor(lang);
  return {
    "invalid-email": m.signInErrorInvalidEmail,
    "too-many-codes": m.signInErrorTooManyCodes,
    "wrong-code": m.signInErrorWrongCode,
    "too-many": m.signInErrorTooMany,
    unreachable: m.signInErrorUnreachable,
    "too-soon": m.signInErrorTooSoon,
    "start-again": m.signInErrorStartAgain,
    "passkey-failed": m.signInErrorPasskeyFailed,
  }[kind];
};

describe.each(["en", "es"] as const)("in %s", (lang) => {
  const m = messagesFor(lang);

  describe("the address step", () => {
    it("asks for the email address and sends it to the code form", () => {
      const html = render(lang);
      const email = inputs(html).find((tag) => attribute(tag, "name") === "email") ?? "";

      expect(html).toContain(`<h1>${m.signInHeading}</h1>`);
      expect(attribute(email, "type")).toBe("email");
      expect(attribute(email, "autocomplete")).toBe("email");
      expect(html).toMatch(new RegExp(`<form[^>]*action="${actions.sendCode}"[^>]*method="post"`));
      expect(html).toMatch(new RegExp(`<input type="hidden" name="lang" value="${lang}"/>`));
      expect(html).not.toContain("autofocus");
    });

    it("shows again the address typed before an error", () => {
      const html = render(lang, { pending: { email: "ana@" }, error: "invalid-email" });
      const email = inputs(html).find((tag) => attribute(tag, "name") === "email") ?? "";

      expect(attribute(email, "value")).toBe("ana@");
    });
  });

  describe("the code step", () => {
    it("asks for the six digits, with the box unticked", () => {
      const html = render(lang, { pending: sent });
      const code = inputs(html).find((tag) => attribute(tag, "name") === "code") ?? "";
      const box = inputs(html).find((tag) => attribute(tag, "name") === "remember") ?? "";

      expect(attribute(code, "inputmode")).toBe("numeric");
      expect(attribute(code, "autocomplete")).toBe("one-time-code");
      expect(attribute(code, "maxlength")).toBe("6");
      expect(attribute(box, "type")).toBe("checkbox");
      expect(attribute(box, "checked")).toBeUndefined();
      expect(html).toContain(escaped(m.signInRemember));
      expect(html).toMatch(new RegExp(`<form[^>]*action="${actions.signIn}"`));
    });

    // As docs/product.md says: always on the screen, not behind a link.
    it("always shows the address, sending again after the wait, and the spam reminder", () => {
      const html = render(lang, { pending: sent });

      expect(html).toContain("ana@example.com");
      expect(html).toContain(escaped(m.signInSpam));
      expect(html).toContain(escaped(m.signInResendHint));
      expect(html).toMatch(
        /<form[^>]*action="\/_serverFn\/send-code"[^>]*>.*<input type="hidden" name="email" value="ana@example.com"\/>/,
      );
      expect(html).toMatch(new RegExp(`<form[^>]*action="${actions.changeAddress}"`));
      expect(html).not.toContain("<details");
    });
  });

  // Each error, on the step it comes back to: its text from the translation
  // files, tied to the step's field, which alone has the focus, so a screen
  // reader reads the field with its error, with or without JavaScript.
  it.each([
    ["invalid-email", {}, "email"],
    ["too-many-codes", {}, "email"],
    ["too-many", {}, "email"],
    ["unreachable", {}, "email"],
    ["start-again", {}, "email"],
    ["wrong-code", { pending: sent }, "code"],
    ["too-many", { pending: sent }, "code"],
    ["unreachable", { pending: sent }, "code"],
    ["too-soon", { pending: sent }, "code"],
    ["too-many-codes", { pending: sent }, "code"],
  ] as const)("%s, %o, is on the %s field, which has the focus", (kind, props, field) => {
    const html = render(lang, { ...props, error: kind });
    const focused = inputs(html).filter((tag) => /\sautofocus=""/.test(tag));

    expect(focused).toHaveLength(1);
    const [tag = ""] = focused;
    expect(attribute(tag, "name")).toBe(field);
    expect(attribute(tag, "aria-invalid")).toBe("true");
    const described = attribute(tag, "aria-describedby")?.split(" ") ?? [];
    expect(described.map((id) => textOf(html, id))).toContain(escaped(errorText(lang, kind)));
  });

  it.each([
    ["the address step", {}],
    ["the passkey offer", { session: signedIn, step: "passkey" as const }],
  ])("a failed passkey says so in its own words, on %s", (_, props) => {
    const html = render(lang, { ...props, error: "passkey-failed" });

    expect(html).toContain(`<p role="alert">${escaped(m.signInErrorPasskeyFailed)}</p>`);
  });

  describe("signed in", () => {
    it("says who, and signs out with a form", () => {
      const html = render(lang, { session: signedIn });

      expect(html).toContain("ana@example.com");
      expect(html).toMatch(new RegExp(`<form[^>]*action="${actions.signOut}"`));
      expect(html).not.toContain(escaped(m.signInPasskeyOfferBody));
    });

    it("after signing in, offers a passkey with its explanation, and 'not now' home", () => {
      const html = render(lang, { session: signedIn, step: "passkey" });

      expect(html).toContain(escaped(m.signInPasskeyOfferBody));
      expect(html).toMatch(new RegExp(`href="/${lang}"[^>]*>${escaped(m.signInNotNow)}</a>`));
    });

    it("says when the passkey is ready", () => {
      expect(render(lang, { session: signedIn, step: "passkey-added" })).toContain(
        escaped(m.signInPasskeyAdded),
      );
    });
  });

  it("takes every value from the tokens", () => {
    const html = [
      render(lang),
      render(lang, { pending: sent, error: "wrong-code" }),
      render(lang, { session: signedIn, step: "passkey" }),
    ].join("");
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list = ""]) =>
      list.split(/\s+/),
    );

    expect(classes.filter((name) => /[[(]/.test(name))).toEqual([]);
    expect(classes.filter((name) => /(^|:)(duration|delay)-\d/.test(name))).toEqual([]);
    expect(html).not.toContain("style=");
  });
});
