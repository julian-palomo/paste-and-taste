---
paths:
  - "apps/web/**"
---

# How the web app is put together

TanStack Start checks none of this; this rule and the reviews do. The records
are `docs/adr/2026-11-14-tanstack-start-for-the-web.md`,
`docs/adr/2026-11-23-web-addresses-per-language.md` and
`docs/adr/2026-11-23-how-the-web-app-deploys.md`.

**Every page is rendered on the server.** The HTML the server sends already
holds the content, its `<title>` and its meta description, so search engines
read it. A page's `head` builds them with `pageHead` (`src/head.ts`), which
also adds the `hreflang` links.

**Routes live in `src/routes/`**, one file per address, and the router plugin
writes `src/routeTree.gen.ts` from them. Each page lives under `$lang/`: its
`params.parse` runs `parseLanguage` and throws `notFound()` for any other
value. `/` (`src/routes/index.tsx`) is a server handler that answers 302
to a language's address. A route file wires; it holds no logic of its own.

**A feature is one folder, `src/<feature>/`**, as in `apps/api`. It holds a
server function in `<feature>.functions.ts`, the code that reads the API, and
a view that is plain React with no router, so tests render it with
`renderToString`. `src/health/` is the model.

**The API is called only inside a server function**, through
`createApiClient` from `@paste-and-taste/api-client` with `WebConfig.api`:
never a hand-written `fetch`, never a copied type, and never from the browser
(the API sends no CORS headers). `WebConfig.api` is the Service binding `API`
when deployed and `API_URL` over HTTP under `vite dev`; never call the
binding's `fetch` detached from it. A call catches `ApiError` and `ApiUnreachableError` and turns
them into states the view shows, with text from the translation files. Never
an error's own message, and never a stack trace.

**Every text a person sees is in `src/i18n/en.json` and `src/i18n/es.json`.**
`en.json` is the shape: a key missing from `es.json` fails `typecheck`. A
component gets its texts as `messages` from `messagesFor(lang)`.

**Configuration.** `src/config/config.ts` parses every variable the web app
reads. `src/server.ts` is the only file that imports from `cloudflare:*`: it
parses the config at module scope, so an invalid value stops the Worker from
starting, and passes it to every request as Start's request context. A server
function gets it, and the request's origin, through the `withConfig`
middleware. A new variable goes into `wrangler.jsonc`'s top level and into
every `env` block (an environment inherits neither `vars` nor `services`),
into `WebConfig` and its test, then `pnpm -C apps/web exec wrangler types`.
`INDEXING` (`src/indexing.ts`) sets `X-Robots-Tag: noindex` on every response;
keep it in step with `NOINDEX_ENVIRONMENTS` in `scripts/check-web.ts`.

**Environments are chosen at build time**, with `CLOUDFLARE_ENV`; `wrangler
deploy` deploys what the build wrote. `scripts/check-web.ts`, run by
`pnpm -C apps/web smoke`, is the check after each deploy: it reads rendered
markup only. Node runs the scripts directly, so `scripts/` uses `.ts`
imports and erasable syntax only.

**Generated files are never edited:** `src/routeTree.gen.ts` (the router
plugin rewrites it on `dev` and `build`) and `worker-configuration.d.ts`
(`wrangler types`). Both are committed, because CI's `Typecheck` job runs with
no build first, and both are excluded from Biome.

**Tests** are vitest on Node with `vitest.config.ts`, which loads no Vite
plugin. Code with behaviour gets a test there; the routes' wiring is checked
by running `pnpm -C apps/web dev` and reading the HTML.
