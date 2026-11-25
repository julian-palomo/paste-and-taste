import { expect, it } from "vitest";
import { homeOf } from "../src/home/home-of.ts";

it.each([
  ["development", "health"],
  ["preview", "health"],
  ["production", "building"],
] as const)("in %s, the home is the %s page", (environment, home) => {
  expect(homeOf(environment)).toBe(home);
});
