import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config/config.ts";

// Stands in for a Service binding. Its fetch reads `this`, so calling it
// detached from the binding fails, as workerd's does with "Illegal invocation".
class FakeBinding {
  private readonly answer = "from the binding";

  async fetch(request: Request): Promise<Response> {
    return new Response(`${this.answer}: ${new URL(request.url).pathname}`);
  }
}

describe("parseConfig", () => {
  it("reads the API's address", () => {
    expect(
      parseConfig({
        API_URL: "http://localhost:8787",
        INDEXING: "allowed",
        APP_ENV: "development",
      }),
    ).toEqual({
      api: { baseUrl: "http://localhost:8787" },
      indexing: "allowed",
      environment: "development",
    });
    expect(
      parseConfig({
        API_URL: "https://api.example.com",
        INDEXING: "allowed",
        APP_ENV: "development",
      }),
    ).toEqual({
      api: { baseUrl: "https://api.example.com" },
      indexing: "allowed",
      environment: "development",
    });
  });

  it("reaches the API through its binding, called on the binding", async () => {
    const config = parseConfig({ API: new FakeBinding(), INDEXING: "blocked", APP_ENV: "preview" });

    expect(config.indexing).toBe("blocked");
    expect(config.environment).toBe("preview");
    expect(config.api.fetch).toBeTypeOf("function");
    const response = await config.api.fetch?.(new Request(`${config.api.baseUrl}/health`));
    expect(await response?.text()).toBe("from the binding: /health");
  });

  it.each([
    ["missing", { INDEXING: "allowed" }],
    ["empty", { API_URL: "", INDEXING: "allowed" }],
    ["relative", { API_URL: "/api", INDEXING: "allowed" }],
    ["not http", { API_URL: "ftp://api.example.com", INDEXING: "allowed" }],
    ["not a string", { API_URL: 8787, INDEXING: "allowed" }],
    ["no variables at all", undefined],
  ])("rejects an API_URL that is %s, naming the variable", (_, variables) => {
    expect(() => parseConfig(variables)).toThrow(/API_URL/);
  });

  it("rejects both the binding and the address, naming both", () => {
    expect(() =>
      parseConfig({
        API: new FakeBinding(),
        API_URL: "http://localhost:8787",
        INDEXING: "allowed",
      }),
    ).toThrow(/API.*API_URL/);
  });

  it("rejects a binding without fetch", () => {
    expect(() => parseConfig({ API: {}, INDEXING: "allowed" })).toThrow(/^API: .*Service binding/);
  });

  it.each([
    ["missing", { API_URL: "http://localhost:8787", APP_ENV: "development" }],
    ["unknown", { API_URL: "http://localhost:8787", INDEXING: "maybe", APP_ENV: "development" }],
  ])("rejects an INDEXING that is %s, naming the variable", (_, variables) => {
    expect(() => parseConfig(variables)).toThrow(/INDEXING/);
  });

  it.each(["development", "preview", "production"])("reads the environment %s", (environment) => {
    expect(
      parseConfig({ API_URL: "http://localhost:8787", INDEXING: "allowed", APP_ENV: environment })
        .environment,
    ).toBe(environment);
  });

  it.each([
    ["missing", { API_URL: "http://localhost:8787", INDEXING: "allowed" }],
    ["unknown", { API_URL: "http://localhost:8787", INDEXING: "allowed", APP_ENV: "staging" }],
  ])("rejects an APP_ENV that is %s, naming the variable", (_, variables) => {
    expect(() => parseConfig(variables)).toThrow(/APP_ENV/);
  });
});
