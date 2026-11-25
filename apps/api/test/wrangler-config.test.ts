import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { unstable_readConfig } from "wrangler";

// The configuration each environment deploys with, as wrangler resolves it
// from wrangler.jsonc with what the environment inherits. It reads the file
// only: no network and no Cloudflare account.
const CONFIG = new URL("../wrangler.jsonc", import.meta.url).pathname;

function configOf(env?: "preview" | "production") {
  return unstable_readConfig({ config: CONFIG, env });
}

// Wrangler warns that vars aren't inherited, which is on purpose here.
beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("where the Worker answers", () => {
  it.each([
    ["preview", "api.preview.pasteandtaste.app"],
    ["production", "api.pasteandtaste.app"],
  ] as const)("in %s, only on %s", (env, hostname) => {
    const config = configOf(env);

    expect(config.routes).toEqual([{ pattern: hostname, custom_domain: true }]);
    expect(config.workers_dev).toBe(false);
    expect(config.preview_urls).toBe(false);
  });

  it("has no route in local development, the top level", () => {
    expect(configOf().routes).toBeUndefined();
  });
});
