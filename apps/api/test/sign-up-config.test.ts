import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { unstable_readConfig } from "wrangler";
import { parseConfig } from "../src/config/config.schema.ts";

// Each environment's sign-up value, as wrangler resolves wrangler.jsonc for
// it. It reads the file only: no network and no Cloudflare account.
const CONFIG = new URL("../wrangler.jsonc", import.meta.url).pathname;

// Wrangler warns that vars aren't inherited, which is on purpose here.
beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("SIGN_UP in wrangler.jsonc", () => {
  it.each([
    ["preview", "invited"],
    ["production", "invited"],
  ] as const)("is %s's %s", (env, value) => {
    expect(unstable_readConfig({ config: CONFIG, env }).vars.SIGN_UP).toBe(value);
  });

  it("is open in local development, the top level", () => {
    expect(unstable_readConfig({ config: CONFIG }).vars.SIGN_UP).toBe("open");
  });
});

describe("SIGN_UP in the configuration", () => {
  it.each(["invited", "open"] as const)("accepts %s", (value) => {
    expect(parseConfig({ APP_ENV: "preview", SIGN_UP: value }).SIGN_UP).toBe(value);
  });

  it("refuses anything else, naming it", () => {
    expect(() => parseConfig({ APP_ENV: "preview", SIGN_UP: "closed" })).toThrow(/SIGN_UP/);
  });
});
