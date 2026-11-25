import { type FormEvent, useEffect, useState } from "react";
import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { Checkbox } from "../pieces/checkbox.tsx";
import type { SignInErrorKind } from "./relay.ts";
import {
  passkeyRegistrationOptionsFn,
  passkeySignInFn,
  passkeySignInOptionsFn,
  registerPasskeyFn,
} from "./sign-in.functions.ts";

// The passkey buttons. WebAuthn runs only in the browser, so they render
// nothing on the server and appear once JavaScript has run, and only where
// the browser can turn the API's JSON options into WebAuthn's own, with no
// library (Baseline 2025 on MDN, PublicKeyCredential.parseCreationOptionsFromJSON).
// The result is always a full page load, so the page shows it from the
// server: the signed-in state, or ?error=.

type Result = { ok: true } | { ok: false; error: SignInErrorKind };

function useSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof PublicKeyCredential !== "undefined" &&
        typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function" &&
        typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function",
    );
  }, []);
  return supported;
}

// The browser's answer, as JSON text for the API. A refused or cancelled
// ceremony rejects, which is a failed passkey like any other.
async function ceremony(run: () => Promise<Credential | null>): Promise<string | undefined> {
  try {
    const credential = await run();
    if (!(credential instanceof PublicKeyCredential)) return undefined;
    return JSON.stringify(credential.toJSON());
  } catch {
    return undefined;
  }
}

async function signInWithPasskey(rememberMe: boolean): Promise<Result> {
  const options = await passkeySignInOptionsFn();
  if (!options.ok) return options;
  const response = await ceremony(() =>
    navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
        JSON.parse(options.optionsJson) as PublicKeyCredentialRequestOptionsJSON,
      ),
    }),
  );
  if (!response) return { ok: false, error: "passkey-failed" };
  return passkeySignInFn({ data: { responseJson: response, rememberMe } });
}

async function createPasskey(): Promise<Result> {
  const options = await passkeyRegistrationOptionsFn();
  if (!options.ok) return options;
  const response = await ceremony(() =>
    navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
        JSON.parse(options.optionsJson) as PublicKeyCredentialCreationOptionsJSON,
      ),
    }),
  );
  if (!response) return { ok: false, error: "passkey-failed" };
  return registerPasskeyFn({ data: { responseJson: response } });
}

export function PasskeySignIn({ lang, messages }: { lang: Language; messages: Messages }) {
  const supported = useSupported();
  if (!supported) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rememberMe = new FormData(event.currentTarget).get("remember") === "on";
    const result = await signInWithPasskey(rememberMe);
    window.location.assign(`/${lang}/sign-in${result.ok ? "" : `?error=${result.error}`}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-4">
      <h2 className="font-display text-xl font-bold">{messages.signInPasskeyHeading}</h2>
      <Checkbox label={messages.signInRemember} name="remember" value="on" />
      <Button kind="secondary" type="submit">
        {messages.signInWithPasskey}
      </Button>
    </form>
  );
}

export function PasskeyRegister({ lang, messages }: { lang: Language; messages: Messages }) {
  const supported = useSupported();
  if (!supported) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await createPasskey();
    window.location.assign(
      `/${lang}/sign-in?step=${result.ok ? "passkey-added" : `passkey&error=${result.error}`}`,
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Button kind="main" type="submit">
        {messages.signInCreatePasskey}
      </Button>
    </form>
  );
}
