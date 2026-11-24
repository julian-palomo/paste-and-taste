import { defineConfig } from "vitest/config";

// Its own config, so vitest doesn't load vite.config.ts: the tests render
// components on Node and need neither the Workers runtime nor the route
// generator.
export default defineConfig({});
