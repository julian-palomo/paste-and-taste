import { createApp, noDatabase } from "@paste-and-taste/api/app";
import { createApiClient } from "@paste-and-taste/api-client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HealthView } from "../src/health/health-view.tsx";
import { readHealth } from "../src/health/read-health.ts";
import { type Language, messagesFor } from "../src/i18n/i18n.ts";

// The real API, called in process.
const api = createApp({ APP_ENV: "development" }, noDatabase);
const realApi = async (request: Request) => api.fetch(request);

// What the API's address answers when the API is up but failing.
const failingApi = async () =>
  Response.json(
    {
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The database is down.",
    },
    { status: 503, headers: { "Content-Type": "application/problem+json" } },
  );

// What fetch does with the API stopped: the Workers runtime rejects with a
// plain Error, Node with a TypeError.
const stoppedApi = async (): Promise<Response> => {
  throw new Error("Network connection lost.");
};

// The page's body as the server renders it, for one language and one API.
async function renderPage(lang: Language, fetch: (request: Request) => Promise<Response>) {
  const client = createApiClient({ baseUrl: "http://api.test", fetch });
  const state = await readHealth(client);
  return renderToString(<HealthView state={state} messages={messagesFor(lang)} />);
}

it("shows the API's answer in English", async () => {
  const html = await renderPage("en", realApi);

  expect(html).toContain("<h1>API status</h1>");
  expect(html).toContain("<dt>Status</dt><dd>ok</dd>");
  expect(html).toContain("<dt>Environment</dt><dd>development</dd>");
});

it("shows the API's answer in Spanish", async () => {
  const html = await renderPage("es", realApi);

  expect(html).toContain("<h1>Estado de la API</h1>");
  expect(html).toContain("<dt>Estado</dt><dd>ok</dd>");
  expect(html).toContain("<dt>Entorno</dt><dd>development</dd>");
});

describe.each(["en", "es"] as const)("in %s", (lang) => {
  const messages = messagesFor(lang);

  it("shows the API-error state, without the error's own words", async () => {
    const html = await renderPage(lang, failingApi);

    expect(html).toContain(`<p role="alert">${messages.apiError}</p>`);
    expect(html).not.toContain("<dl");
    expect(html).not.toMatch(/Service Unavailable|database is down|503/);
  });

  it("shows the not-reachable state, without the error's own words", async () => {
    const html = await renderPage(lang, stoppedApi);

    expect(html).toContain(`<p role="alert">${messages.unreachable}</p>`);
    expect(html).not.toContain("<dl");
    expect(html).not.toMatch(/Network connection lost|could not be reached/);
  });
});
