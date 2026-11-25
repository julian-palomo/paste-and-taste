import { type FormEvent, useEffect, useState } from "react";
import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { Checkbox } from "../pieces/checkbox.tsx";
import {
  createPasskey as createPasskeyFlow,
  signInWithPasskey as signInWithPasskeyFlow,
} from "./passkey-flow.ts";
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

// The browser's part of each ceremony: the API's options turned into
// WebAuthn's own, and the credential back as JSON text, or null when there is
// none. passkey-flow.ts decides what a failure is.
const asJson = (credential: Credential | null) =>
  credential instanceof PublicKeyCredential ? JSON.stringify(credential.toJSON()) : null;

const getCredential = async (optionsJson: string) =>
  asJson(
    await navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
        JSON.parse(optionsJson) as PublicKeyCredentialRequestOptionsJSON,
      ),
    }),
  );

const createCredential = async (optionsJson: string) =>
  asJson(
    await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
        JSON.parse(optionsJson) as PublicKeyCredentialCreationOptionsJSON,
      ),
    }),
  );

const signInWithPasskey = (rememberMe: boolean) =>
  signInWithPasskeyFlow({
    getOptions: () => passkeySignInOptionsFn(),
    get: getCredential,
    signIn: (responseJson) => passkeySignInFn({ data: { responseJson, rememberMe } }),
  });

const createPasskey = () =>
  createPasskeyFlow({
    getOptions: () => passkeyRegistrationOptionsFn(),
    create: createCredential,
    register: (responseJson) => registerPasskeyFn({ data: { responseJson } }),
  });

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
