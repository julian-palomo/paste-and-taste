import { expect, it } from "vitest";
import { applyIndexing } from "../src/indexing.ts";

const page = () =>
  new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });

it("tells search engines not to index when indexing is blocked", async () => {
  const response = applyIndexing(page(), "blocked");

  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/html");
  expect(await response.text()).toBe("<html></html>");
});

it("keeps a redirect's status and Location when indexing is blocked", () => {
  const redirect = new Response(null, { status: 302, headers: { Location: "/en" } });
  const response = applyIndexing(redirect, "blocked");

  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/en");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
});

it("leaves the response as it is when indexing is allowed", () => {
  const original = page();
  expect(applyIndexing(original, "allowed")).toBe(original);
});
