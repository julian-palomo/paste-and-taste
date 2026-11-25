// Usage: pnpm -C apps/api smoke <base address> [environment]
// Exits 0 when the API at that address answers as specified, 1 otherwise. With
// an environment, /health must name that one; without, any of the three passes.
import { checkApi } from "../src/smoke/check-api.ts";

const baseUrl = process.argv[2];
const expectedEnvironment = process.argv[3];
if (!baseUrl) {
  console.error("Usage: pnpm -C apps/api smoke <base address> [environment]");
  process.exit(1);
}

try {
  const failures = await checkApi(baseUrl, (url) => fetch(url), expectedEnvironment);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length > 0) process.exit(1);
  const target = expectedEnvironment ? `${baseUrl} (${expectedEnvironment})` : baseUrl;
  console.log(`OK ${target}: /health, /wake and an unknown route answer as specified`);
} catch (error) {
  console.error(`FAIL could not reach ${baseUrl}:`, error);
  process.exit(1);
}
