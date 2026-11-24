---
paths:
  - "apps/web/**"
---

# How the web app is put together

TanStack Start checks none of this; this rule and the reviews do. The records
are `docs/adr/2026-11-14-tanstack-start-for-the-web.md`,
`docs/adr/2026-11-23-web-addresses-per-language.md`,
`docs/adr/2026-11-23-how-the-web-app-deploys.md`,
`docs/adr/2026-11-23-tailwind-and-css-motion.md` and
`docs/adr/2026-11-24-fonts-from-the-app-and-dark-mode-from-the-device.md`.

**Every page is rendered on the server.** The HTML the server sends already
holds the content, its `<title>` and its meta description, so search engines
read it. A page's `head` builds them with `pageHead` (`src/head.ts`), which
also adds the `hreflang` links.

**Routes live in `src/routes/`**, one file per address, and the router plugin
writes `src/routeTree.gen.ts` from them. Each page lives under `$lang/`: its
`params.parse` runs `parseLanguage` and throws `notFound()` for any other
value. Each page route sets `onError: keepErrorOnServer`
(`src/layout/keep-error-on-server.ts`). `/` (`src/routes/index.tsx`) is a
server handler that answers 302 to a language's address. A route file wires;
it holds no logic of its own.

**The layout comes from the root.** `src/routes/__root.tsx` reads the
language from the address with `languageOfPath` and wraps every page in
`Layout` (`src/layout/`): the header with the app's name and the link to the
same page in the other language, `<main>`, and the footer. A page renders only
its own content, starting with its one `<h1>`; it never renders `<main>`, a
header or a footer. `Layout` also provides the page's language and address,
which `usePage()` reads.

**Not found and errors.** Any address no route matches, and any `notFound()`
a route throws, renders the root's `notFoundComponent`, `NotFoundPage`, inside
the layout, with status 404. An error thrown while a page loads (its `loader`
or `beforeLoad`) renders the router's `defaultErrorComponent`, `ErrorPage`, in
its place, with status 500; never set `errorComponent` on the root, which
would replace the layout and `<html>`. The router sends a load's error to the
browser with its message, in the page's hydration script: `keepErrorOnServer`
logs the original and throws a bare error in its place, so a page route
without it leaks the message. Read data that can fail in a loader, not while
rendering: an error thrown while rendering answers 200 with an empty
`<main>`, and the error page appears only once JavaScript runs (under `vite
dev`, React also writes the message and the stack into the HTML). Not checked
yet: what a failed server function sends to the browser on a client-side
navigation.

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

**Styles are Tailwind utilities from the tokens.** Every colour, font,
radius, duration and easing is a token in `src/styles/tokens.css`, named by
its role, never by its value. A component takes those only from the tokens'
utilities (`bg-surface`, `text-text-muted`, `rounded-control`,
`duration-quick`): never a raw or arbitrary one like `bg-[#fff]` or
`duration-[300ms]`. Spacing, sizes and type sizes use Tailwind's own scale.
Tailwind's own palette, fonts, radii and easings are removed there, so
`bg-red-500` doesn't exist. Every colour has a light value in `@theme
static` and a dark one in the `prefers-color-scheme: dark` block after it, so
no component knows which mode is on; `test/tokens.test.ts` fails when the two
sets name different tokens. A new role is a new token in that file,
under Tailwind's namespace for it: a duration is `--transition-duration-*`,
or `duration-*` silently produces nothing. `src/styles/app.css` imports
Tailwind, the tokens and the fonts, and styles what has no class (`body`, `h1`, focus);
the root links it from `<head>`, so a page is styled before JavaScript runs.
The typefaces come only from `src/styles/fonts.css`, served by the app, never
by another host, with `font-display: optional`; `src/styles/fonts.ts`
preloads the same files from the root, and `test/fonts.test.ts` fails when the
two name different files. `public/_headers` caches `/assets/*` for a year:
never widen it to a file without a hash in its name.
Markup the deploy check or a test matches exactly (`<h1>`, `<dt>`, `<dd>`, `<p
role="alert">`) carries no class and is styled from its parent.

**Motion is CSS, with no animation library.** Hover, focus and a press are CSS
transitions from the tokens' durations and easings; a bare `transition` takes
the default ones, which the tokens set too. With `prefers-reduced-motion:
reduce` the duration tokens are zero, so a transition written from them stops
on its own. Page transitions, springs and gestures come with the screens that
need them: keyframes, the Web Animations API, View Transitions and a small
spring of our own.

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
