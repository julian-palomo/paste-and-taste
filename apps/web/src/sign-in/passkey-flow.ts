import type { SignInErrorKind } from "./relay.ts";

// The two passkey ceremonies, with the browser's part passed in: options and
// answers cross as JSON text, and `create` and `get` are the WebAuthn calls,
// which resolve to the credential's JSON, to null, or reject when the person
// cancels or the device refuses. No DOM here, so tests run them on Node;
// passkey.tsx passes the real calls.
type Result = { ok: true } | { ok: false; error: SignInErrorKind };
type Options = { ok: true; optionsJson: string } | { ok: false; error: SignInErrorKind };

async function ceremony(run: () => Promise<string | null>): Promise<string | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export async function createPasskey(steps: {
  getOptions: () => Promise<Options>;
  create: (optionsJson: string) => Promise<string | null>;
  register: (responseJson: string) => Promise<Result>;
}): Promise<Result> {
  const options = await steps.getOptions();
  if (!options.ok) return options;
  const response = await ceremony(() => steps.create(options.optionsJson));
  if (response === null) return { ok: false, error: "passkey-not-created" };
  return steps.register(response);
}

export async function signInWithPasskey(steps: {
  getOptions: () => Promise<Options>;
  get: (optionsJson: string) => Promise<string | null>;
  signIn: (responseJson: string) => Promise<Result>;
}): Promise<Result> {
  const options = await steps.getOptions();
  if (!options.ok) return options;
  const response = await ceremony(() => steps.get(options.optionsJson));
  if (response === null) return { ok: false, error: "passkey-failed" };
  return steps.signIn(response);
}
