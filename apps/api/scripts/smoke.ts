// Usage: pnpm -C apps/api smoke <base address>
// Exits 0 when the API at that address answers as specified, 1 otherwise.
import { checkApi } from "../src/smoke/check-api.ts";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: pnpm -C apps/api smoke <base address>");
  process.exit(1);
}

try {
  const failures = await checkApi(baseUrl, (url) => fetch(url));
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log(`OK ${baseUrl}: /health and an unknown route answer as specified`);
} catch (error) {
  console.error(`FAIL could not reach ${baseUrl}:`, error);
  process.exit(1);
}
