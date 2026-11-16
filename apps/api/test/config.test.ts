import { expect, it } from "vitest";
import { createApp } from "../src/app";

it("refuses to build without APP_ENV, and names it", () => {
  expect(() => createApp({})).toThrow(/APP_ENV/);
});
