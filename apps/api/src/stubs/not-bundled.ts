// What wrangler.jsonc's "alias" points the optional packages NestJS imports
// lazily at. Nest imports each one only when a feature that needs it is used,
// and treats a failed import as "not installed", which this reproduces.
throw new Error("This package is not bundled into the Worker.");
