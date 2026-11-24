import { afterEach, describe, expect, it, vi } from "vitest";
import { keepErrorOnServer } from "../src/layout/keep-error-on-server.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// What keepErrorOnServer throws, which the router sends to the browser.
function thrownBy(original: unknown): unknown {
  try {
    keepErrorOnServer(original);
  } catch (thrown) {
    return thrown;
  }
  throw new Error("keepErrorOnServer returned instead of throwing");
}

describe("keepErrorOnServer", () => {
  it("throws an error that holds nothing of the original", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("provoked failure 7f3a", { cause: "db password" });

    const thrown = thrownBy(original);

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBe(original);
    const { message, cause, stack } = thrown as Error;
    expect(cause).toBeUndefined();
    expect(`${message} ${stack}`).not.toMatch(/provoked failure|7f3a|db password/);
  });

  it("logs the original, so the server's log keeps it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("provoked failure 7f3a");

    thrownBy(original);

    expect(log).toHaveBeenCalledWith(original);
  });
});
