import type { CodeSender, Language } from "./code-sender.ts";
import { CodeNotSentError } from "./login-errors.ts";

// Sends the sign-in code by email through Resend's API, from the app's own
// subdomain (docs/adr/2026-11-25-resend-for-the-sign-in-code.md). One POST
// with fetch, so no dependency: https://resend.com/docs/api-reference/emails/send-email

const RESEND_EMAILS = "https://api.resend.com/emails";
const FROM = "Paste & Taste <login@mail.pasteandtaste.app>";

// Resend's documented error names: https://resend.com/docs/api-reference/errors.
// Only these reach the log; anything else is "unknown", so nothing a body
// carries (an address, a message) ever does.
const RESEND_ERRORS = new Set([
  "invalid_idempotency_key",
  "validation_error",
  "missing_api_key",
  "restricted_api_key",
  "email_above_quota",
  "invalid_permission",
  "suspended_api_key",
  "not_found",
  "method_not_allowed",
  "concurrent_idempotent_requests",
  "invalid_idempotent_request",
  "resource_locked",
  "invalid_attachment",
  "invalid_parameter",
  "missing_required_field",
  "missing_required_parameter",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
  "application_error",
  "dns_lookup_failed",
  "service_unavailable",
]);

const WORDS = {
  es: {
    subject: "Tu código para entrar",
    expires: "Caduca en 5 minutos.",
    ignore: "Si no lo has pedido tú, ignora este correo.",
  },
  en: {
    subject: "Your sign-in code",
    expires: "It expires in 5 minutes.",
    ignore: "If you didn't ask for it, ignore this email.",
  },
} satisfies Record<Language, Record<string, string>>;

// The email for a code: no images and no links, so nothing to track and
// nothing that looks like phishing.
function codeEmail(code: string, language: Language) {
  const words = WORDS[language];
  return {
    subject: `${words.subject}: ${code}`,
    text: `${code}\n\n${words.expires}\n${words.ignore}\n`,
    html:
      `<div style="font-family:sans-serif;color:#1f2a1d">` +
      `<p style="font-size:32px;font-weight:700;letter-spacing:4px;margin:0 0 16px">${code}</p>` +
      `<p style="margin:0 0 8px">${words.expires}</p>` +
      `<p style="margin:0;color:#5b6657">${words.ignore}</p>` +
      `</div>`,
  };
}

type ResendSenderOptions = {
  apiKey: string;
  // Called as a plain function, never as a stored method: workerd refuses a
  // global fetch called detached from its owner ("Illegal invocation").
  fetch?: (request: Request) => Promise<Response>;
  // Its own limit, apart from the database's: a slow Resend is a failed send.
  timeoutMs?: number;
};

class TimedOut extends Error {}

export function createResendCodeSender({
  apiKey,
  fetch = (request) => globalThis.fetch(request),
  timeoutMs = 10_000,
}: ResendSenderOptions): CodeSender {
  return {
    async send(email, code, language) {
      const controller = new AbortController();
      const request = new Request(RESEND_EMAILS, {
        method: "POST",
        // The key goes only here: never in the URL, the body or a log line.
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email, ...codeEmail(code, language) }),
        signal: controller.signal,
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new TimedOut());
        }, timeoutMs);
      });

      let response: Response;
      try {
        response = await Promise.race([fetch(request), deadline]);
      } catch (error) {
        refused(error instanceof TimedOut ? "timeout" : "unreachable", "unknown");
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) refused(String(response.status), await errorName(response));
    },
  };
}

// One line, the status and Resend's error name only: never the address, the
// code, the key or Resend's message (docs/adr/2026-11-25-logs-in-workers-logs.md).
function refused(status: string, name: string): never {
  console.error(`Resend refused the sign-in code: ${status} ${name}`);
  throw new CodeNotSentError();
}

async function errorName(response: Response): Promise<string> {
  try {
    const { name } = (await response.json()) as { name?: unknown };
    return typeof name === "string" && RESEND_ERRORS.has(name) ? name : "unknown";
  } catch {
    return "unknown";
  }
}
