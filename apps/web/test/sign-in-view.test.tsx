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
const resent = { ...sent, resent: true as const };

function render(
  lang: Language,
  props: {
    session?: Session;
    pending?: { email: string; sentAt?: number; resent?: true };
    error?: SignInErrorKind;
    step?: "passkey" | "passkey-added";
    next?: string;
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
      next={props.next}
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
    "passkey-not-created": m.signInErrorPasskeyNotCreated,
    "code-not-sent": m.signInErrorCodeNotSent,
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

  // After "Enviar otro código": a notice, not an alert, read out with the code
  // field, which takes the focus because the page came back from a form.
  describe("another code sent", () => {
    it("says so on the code step, tied to the code field, which has the focus", () => {
      const html = render(lang, { pending: resent });
      const focused = inputs(html).filter((tag) => /\sautofocus=""/.test(tag));

      expect(focused).toHaveLength(1);
      const [tag = ""] = focused;
      expect(attribute(tag, "name")).toBe("code");
      expect(attribute(tag, "aria-invalid")).toBeUndefined();
      const [first = ""] = attribute(tag, "aria-describedby")?.split(" ") ?? [];
      expect(textOf(html, first)).toBe(escaped(m.signInCodeResent));
    });

    it("reads as a success: no alert, no danger, and a tick hidden from screen readers", () => {
      const html = render(lang, { pending: resent });
      const notice = new RegExp(
        `<p[^>]*>(<svg[^>]*aria-hidden="true"[^>]*>.*?</svg>)<span[^>]*>${escapeRegExp(escaped(m.signInCodeResent))}</span></p>`,
      ).exec(html)?.[0];

      expect(notice).toBeDefined();
      expect(notice).not.toContain("role=");
      expect(notice).not.toContain("danger");
    });

    it("isn't there after the first code, and the field has no focus", () => {
      const html = render(lang, { pending: sent });

      expect(html).not.toContain(escaped(m.signInCodeResent));
      expect(html).not.toContain("autofocus");
    });

    it("gives way to an error: a wrong code after it shows the error alone", () => {
      const html = render(lang, { pending: resent, error: "wrong-code" });

      expect(html).not.toContain(escaped(m.signInCodeResent));
      expect(html).toContain(escaped(errorText(lang, "wrong-code")));
    });

    it.each([
      ["the email step", { pending: { email: "ana@example.com", resent: true as const } }],
      ["the signed-in page", { session: signedIn, pending: resent }],
      ["the passkey offer", { session: signedIn, step: "passkey" as const, pending: resent }],
    ])("never shows on %s", (_, props) => {
      expect(render(lang, props)).not.toContain(escaped(m.signInCodeResent));
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
    ["code-not-sent", {}, "email"],
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

  it("a passkey that couldn't be created says so in its own words, on the offer", () => {
    const html = render(lang, { session: signedIn, step: "passkey", error: "passkey-not-created" });

    expect(html).toContain(`<p role="alert">${escaped(m.signInErrorPasskeyNotCreated)}</p>`);
    expect(html).not.toContain(escaped(m.signInErrorPasskeyFailed));
  });

  // Creating a passkey only happens from the offer; typed into another
  // step's address, its error shows nothing and takes no focus.
  it.each([
    ["the address step", {}],
    ["the code step", { pending: sent }],
  ])("passkey-not-created shows nothing on %s", (_, props) => {
    const html = render(lang, { ...props, error: "passkey-not-created" });

    expect(html).not.toContain(escaped(m.signInErrorPasskeyNotCreated));
    expect(html).not.toContain("autofocus");
    expect(html).not.toContain('aria-invalid="true"');
  });

  // A code that couldn't be sent sends the page back to the email step; typed
  // into any other state's address, it shows nothing and takes no focus.
  it.each([
    ["the code step", { pending: sent }],
    ["the signed-in page", { session: signedIn }],
    ["the passkey offer", { session: signedIn, step: "passkey" as const }],
  ])("code-not-sent shows nothing on %s", (_, props) => {
    const html = render(lang, { ...props, error: "code-not-sent" });

    expect(html).not.toContain(escaped(m.signInErrorCodeNotSent));
    expect(html).not.toContain("autofocus");
    expect(html).not.toContain('aria-invalid="true"');
  });

  // "Enviar otro código" posts the page's language, as the first code's form does.
  it("sends the page's language with another code", () => {
    const html = render(lang, { pending: sent });

    expect(html).toMatch(
      new RegExp(
        `<form[^>]*action="${actions.sendCode}"[^>]*><input type="hidden" name="lang" value="${lang}"/><input type="hidden" name="email" value="ana@example.com"/>`,
      ),
    );
  });

  it("sends next back with every form of the steps", () => {
    for (const html of [
      render(lang, { next: "/es/recipes" }),
      render(lang, { pending: sent, next: "/es/recipes" }),
    ]) {
      const forms = html.match(/<form[^>]*>/g) ?? [];
      const nextFields =
        html.match(/<input type="hidden" name="next" value="\/es\/recipes"\/>/g) ?? [];
      expect(forms.length).toBeGreaterThan(0);
      expect(nextFields).toHaveLength(forms.length);
    }
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
