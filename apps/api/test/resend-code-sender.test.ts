import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseCodeSender, consoleCodeSender } from "../src/login/code-sender.ts";
import { CodeNotSentError } from "../src/login/login-errors.ts";
import { createResendCodeSender } from "../src/login/resend-code-sender.ts";

// A made-up key: the tests never call Resend.
const KEY = "re_test_key_never_real";
const EMAIL = "ana@example.com";
const CODE = "482913";

afterEach(() => {
  vi.restoreAllMocks();
});

// A fetch that answers `response` and keeps each request it was handed.
function recording(response: () => Response) {
  const requests: Request[] = [];
  const fetch = async (request: Request) => {
    requests.push(request);
    return response();
  };
  return { fetch, requests };
}

const sent = () => new Response(JSON.stringify({ id: "49a3999c" }), { status: 200 });

// What console.error was called with, as text, for checking what the log holds.
function errorLog() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
}

describe("the Resend sender", () => {
  it.each([
    ["es", "Tu código para entrar"],
    ["en", "Your sign-in code"],
  ] as const)("posts the code to Resend in %s", async (language, subject) => {
    const { fetch, requests } = recording(sent);

    await createResendCodeSender({ apiKey: KEY, fetch }).send(EMAIL, CODE, language);

    const request = requests[0];
    const body = (await request?.json()) as Record<string, string>;
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.resend.com/emails");
    expect(body.from).toBe("Paste & Taste <login@mail.pasteandtaste.app>");
    expect(body.to).toBe(EMAIL);
    expect(body.subject).toBe(`${subject}: ${CODE}`);
    expect(body.text).toContain(CODE);
    expect(body.html).toContain(CODE);
  });

  it("puts the key only in the Authorization header", async () => {
    const { fetch, requests } = recording(sent);

    await createResendCodeSender({ apiKey: KEY, fetch }).send(EMAIL, CODE, "en");

    const request = requests[0] as Request;
    const others = [...request.headers].filter(([name]) => name !== "authorization");
    expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(others.some(([, value]) => value.includes(KEY))).toBe(false);
    expect(request.url).not.toContain(KEY);
    expect(await request.text()).not.toContain(KEY);
  });

  it("throws CodeNotSentError on an error answer, logging only its status and name", async () => {
    const log = errorLog();
    const { fetch } = recording(
      () =>
        new Response(
          JSON.stringify({ statusCode: 422, name: "invalid_parameter", message: `Bad ${EMAIL}` }),
          { status: 422 },
        ),
    );

    const error = await createResendCodeSender({ apiKey: KEY, fetch })
      .send(EMAIL, CODE, "en")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CodeNotSentError);
    expect(log()).toContain("422 invalid_parameter");
    for (const secret of [EMAIL, CODE, KEY]) expect(log()).not.toContain(secret);
  });

  it("throws CodeNotSentError when fetch rejects", async () => {
    const log = errorLog();
    const fetch = async () => {
      throw new TypeError(`connect failed for ${EMAIL}`);
    };

    const error = await createResendCodeSender({ apiKey: KEY, fetch })
      .send(EMAIL, CODE, "en")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CodeNotSentError);
    expect(log()).toContain("unreachable");
    for (const secret of [EMAIL, CODE, KEY]) expect(log()).not.toContain(secret);
  });

  it("throws CodeNotSentError when Resend never answers, within its limit", async () => {
    const log = errorLog();
    const never = () => new Promise<Response>(() => {});

    const started = performance.now();
    const error = await createResendCodeSender({ apiKey: KEY, fetch: never, timeoutMs: 50 })
      .send(EMAIL, CODE, "en")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CodeNotSentError);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(log()).toContain("timeout");
  });
});

describe("which sender runs where", () => {
  it("prints the code in development without a key", () => {
    expect(chooseCodeSender({ APP_ENV: "development" })).toBe(consoleCodeSender);
  });

  it("sends through Resend when the key is set", async () => {
    const { fetch, requests } = recording(sent);

    await chooseCodeSender({ APP_ENV: "development", RESEND_API_KEY: KEY }, fetch).send(
      EMAIL,
      CODE,
      "en",
    );

    expect(requests[0]?.url).toBe("https://api.resend.com/emails");
  });

  it.each(["preview", "production"] as const)(
    "refuses to start without the key in %s, naming it",
    (env) => {
      expect(() => chooseCodeSender({ APP_ENV: env })).toThrow(/RESEND_API_KEY/);
    },
  );
});
