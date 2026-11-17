// Calls Workers AI's REST API from outside a Worker. The token needs
// "Workers AI - Read" and "Workers AI - Edit", and nothing else.
// https://developers.cloudflare.com/workers-ai/get-started/rest-api/

function credentials(): { account: string; token: string } {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token)
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set");
  return { account, token };
}

/** Carries the status and Cloudflare's error code; never the error's text, which may quote the input. */
class CloudflareError extends Error {
  readonly status: number;

  constructor(status: number, code: unknown) {
    super(`Workers AI answered ${status}`);
    this.name = typeof code === "number" ? `CloudflareError code ${code}` : "CloudflareError";
    this.status = status;
  }
}

/** POSTs `body` to `path` under the account's `/ai/` and returns the parsed JSON answer. */
export async function workersAi(path: string, body: unknown): Promise<unknown> {
  const { account, token } = credentials();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/${path}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const failed: unknown = await response.json().catch(() => null);
    const errors = (failed as { errors?: { code?: unknown }[] } | null)?.errors;
    throw new CloudflareError(response.status, errors?.[0]?.code);
  }
  return response.json();
}
