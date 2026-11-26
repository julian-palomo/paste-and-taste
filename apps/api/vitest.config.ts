import { defineConfig } from "vitest/config";

// A hook gets 30 s, three times vitest's 10 s: each test file that needs a
// database starts one in beforeAll (test/postgres.ts), a PGlite with the
// migrations applied, and while Turborepo runs the other workspaces' tests
// beside these that start takes up to about 11 s on the owner's Mac. A single
// test keeps vitest's 5 s.
export default defineConfig({ test: { hookTimeout: 30_000 } });
