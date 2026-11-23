// Usage: pnpm -C apps/web smoke <base address> <environment>
// Exits 0 when the web app at that address answers as specified, with the API
// behind it naming that environment, and 1 otherwise.
import { checkWeb } from "./check-web.ts";

const baseUrl = process.argv[2];
const environment = process.argv[3];
if (!baseUrl || !environment) {
  console.error("Usage: pnpm -C apps/web smoke <base address> <environment>");
  process.exit(1);
}

try {
  const failures = await checkWeb(baseUrl, (url, init) => fetch(url, init), environment);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log(`OK ${baseUrl} (${environment}): /en, /es and / answer as specified`);
} catch (error) {
  console.error(`FAIL could not reach ${baseUrl}:`, error);
  process.exit(1);
}
