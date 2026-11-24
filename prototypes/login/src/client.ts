// Calls the spike's Worker from the owner's machine. Every timing is wall time
// here, from sending the request to having read the whole answer. Nothing in
// an Outcome holds the token, a cookie, a password or the address.

export const HOSTS = ["neon", "planetscale"] as const;
export type Host = (typeof HOSTS)[number];

export type Outcome = {
  /** 0 when no answer arrived: the network failed or the request timed out. */
  status: number;
  ms: number;
  /**
   * The answer's body, or the network error, cut to 200 characters, when not a
   * 2xx. Never empty: the summary times every answer without an error.
   */
  error?: string;
};

type Sent = Outcome & { cookie?: string; body?: unknown };

const TIMEOUT_MS = 60_000;

export class WorkerClient {
  readonly #origin: string;
  readonly #token: string | undefined;

  /** The Worker's origin: what a passkey's client data names. */
  get origin(): string {
    return this.#origin;
  }

  constructor(address: string, token: string | undefined) {
    this.#origin = new URL(address).origin;
    this.#token = token;
  }

  async send(
    path: string,
    init: { method?: string; json?: unknown; cookie?: string; withToken?: boolean } = {},
  ): Promise<Sent> {
    const headers = new Headers({ origin: this.#origin });
    if (init.withToken !== false && this.#token)
      headers.set("authorization", `Bearer ${this.#token}`);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.json !== undefined) headers.set("content-type", "application/json");

    const start = performance.now();
    try {
      const response = await fetch(`${this.#origin}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.json === undefined ? null : JSON.stringify(init.json),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      const ms = performance.now() - start;
      const cookie = response.headers
        .getSetCookie()
        .map((line) => line.split(";")[0])
        .join("; ");
      const ok = response.status >= 200 && response.status < 300;
      return {
        status: response.status,
        ms,
        ...(ok ? {} : { error: text.slice(0, 200) || "(empty body)" }),
        ...(cookie ? { cookie } : {}),
        body: ok && text ? safeJson(text) : undefined,
      };
    } catch (error) {
      return {
        status: 0,
        ms: performance.now() - start,
        error: String(error instanceof Error ? error.message : error).slice(0, 200),
      };
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type Account = { email: string; password: string };

export function signUp(client: WorkerClient, host: Host, account: Account, n: number) {
  return client.send(`/${host}/api/auth/sign-up/email`, {
    method: "POST",
    json: { ...account, name: `Spike User ${n}` },
  });
}

export function signIn(client: WorkerClient, host: Host, account: Account) {
  return client.send(`/${host}/api/auth/sign-in/email`, { method: "POST", json: account });
}

export async function readSession(client: WorkerClient, host: Host, cookie: string) {
  const sent = await client.send(`/${host}/api/auth/get-session`, { cookie });
  // Better Auth answers 200 with null for a missing or expired session.
  if (sent.status === 200 && sent.body === null) return { ...sent, error: "200 with no session" };
  return sent;
}

export function wake(client: WorkerClient, host: Host) {
  return client.send(`/${host}/wake`);
}

/** Joins two Cookie headers; a cookie in `next` replaces one of the same name. */
export function mergeCookies(previous: string | undefined, next: string | undefined): string {
  const jar = new Map<string, string>();
  for (const header of [previous, next]) {
    for (const pair of (header ?? "").split("; ")) {
      const name = pair.split("=")[0];
      if (name) jar.set(name, pair);
    }
  }
  return [...jar.values()].join("; ");
}

export function askForCode(client: WorkerClient, host: Host, email: string) {
  return client.send(`/${host}/api/auth/email-otp/send-verification-otp`, {
    method: "POST",
    json: { email, type: "sign-in" },
  });
}

/** The code the last `askForCode` stored, read through the spike's own route. */
export async function readCode(client: WorkerClient, host: Host, email: string) {
  const sent = await client.send(`/${host}/spike/code?email=${encodeURIComponent(email)}`);
  const otp = (sent.body as { otp?: unknown } | undefined)?.otp;
  return { ...sent, otp: typeof otp === "string" ? otp : undefined };
}

export function signInWithCode(client: WorkerClient, host: Host, email: string, otp: string) {
  return client.send(`/${host}/api/auth/sign-in/email-otp`, {
    method: "POST",
    json: { email, otp },
  });
}

export function passkeyRegisterOptions(client: WorkerClient, host: Host, cookie: string) {
  return client.send(`/${host}/api/auth/passkey/generate-register-options`, { cookie });
}

export function passkeyVerifyRegistration(
  client: WorkerClient,
  host: Host,
  cookie: string,
  response: unknown,
) {
  return client.send(`/${host}/api/auth/passkey/verify-registration`, {
    method: "POST",
    json: { response },
    cookie,
  });
}

export function passkeySignInOptions(client: WorkerClient, host: Host) {
  return client.send(`/${host}/api/auth/passkey/generate-authenticate-options`);
}

export function passkeyVerifySignIn(
  client: WorkerClient,
  host: Host,
  cookie: string,
  response: unknown,
) {
  return client.send(`/${host}/api/auth/passkey/verify-authentication`, {
    method: "POST",
    json: { response },
    cookie,
  });
}
