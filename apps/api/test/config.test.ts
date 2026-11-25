import { expect, it } from "vitest";
import { createApp, noDatabase } from "../src/app.ts";

it("refuses to build without APP_ENV, and names it", () => {
  expect(() => createApp({}, noDatabase)).toThrow(/APP_ENV/);
});
