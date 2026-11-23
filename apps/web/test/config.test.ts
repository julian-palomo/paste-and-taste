import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config/config.ts";

describe("parseConfig", () => {
  it("reads the API's address", () => {
    expect(parseConfig({ API_URL: "http://localhost:8787" })).toEqual({
      apiUrl: "http://localhost:8787",
    });
    expect(parseConfig({ API_URL: "https://api.example.com" })).toEqual({
      apiUrl: "https://api.example.com",
    });
  });

  it.each([
    ["missing", {}],
    ["empty", { API_URL: "" }],
    ["relative", { API_URL: "/api" }],
    ["not http", { API_URL: "ftp://api.example.com" }],
    ["not a string", { API_URL: 8787 }],
    ["no variables at all", undefined],
  ])("rejects an API_URL that is %s, naming the variable", (_, variables) => {
    expect(() => parseConfig(variables)).toThrow(/API_URL/);
  });
});
