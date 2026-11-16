import { expect, it } from "vitest";
import { createApp } from "../src/app";

it("answers /health with ok and the environment", async () => {
  const app = createApp({ APP_ENV: "development" });

  const response = await app.request("/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", environment: "development" });
});
