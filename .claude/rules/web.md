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

**The sign-in relays the login between the browser and the API.** The
browser never calls the API, so a server function that calls a `/login`
route sends the API the browser's `cookie`, `user-agent` and
`cf-connecting-ip`, built by `relayHeaders` (`src/sign-in/relay.ts`), and
hands each `Set-Cookie` the API answers with back to the browser unchanged.
The IP is read as the `cf-connecting-ip` header, never with Start's
`getRequestIP`, which finds nothing on Workers. Nothing reads, rewrites or
logs a cookie. The address being signed in with sits between the steps in a
cookie of the web app's own, `sign_in_pending` (`HttpOnly`, 15 minutes, and
`Secure` when the page is served over HTTPS), never in the page's address. The code path works with no JavaScript: each
step is a form posted to a server function's `url`, which answers with a 303
back to the page, the cookies on it, and `?error=<kind>` when it failed; the
field with the error is rendered with `autoFocus`, which React writes into
the server's HTML. Asking for a code sends the page's language, so the email
arrives in it, and a 502 (the email couldn't be sent) is `code-not-sent`, shown
only on the email step. Start refuses a server function request that carries no
`Sec-Fetch-Site`, `Origin` or `Referer` of the same origin, with 403, so a
script trying a form has to send them as a browser does. The passkey needs
JavaScript: WebAuthn runs in the browser with its own JSON helpers, and its
options and answers cross the server functions as JSON text;
`src/sign-in/passkey-flow.ts` holds both ceremonies with the browser's calls
passed in, so tests run them on Node. A passkey that couldn't be created
(`passkey-not-created`) and one that couldn't sign in (`passkey-failed`) have
their own words. The page answers only in development, where the API mounts
`/login` (`signInShown`), and so does every sign-in server function: each is an
address of its own, so each checks it, and a form answers 404 elsewhere.

**Recipes, in `src/recipes/`.** The list, a recipe and one form for a new
recipe and an edited one, at `/<lang>/recipes`, `/new`, `/<id>` and
`/<id>/edit`, answer only in development, where the API mounts `/recipes`
(`recipesShown`); every page and server function there checks it, and a GET
function answers 404 elsewhere with `setResponseStatus`. What the sign-in and
the recipes share sits in `src/session/`: `relayHeaders`, which passes the
browser's `cookie`, `user-agent` and `cf-connecting-ip` on and never the web
app's own cookies (`sign_in_pending`, `recipe_draft_*`), `relayed` and
`formResponse`. A read returns a state (`ok`, `signed-out`, `not-found`,
`unreachable`, `api-error`, `not-shown`); the loader turns `signed-out` into
`redirect` to `/<lang>/sign-in?next=<path>` and `not-found` into `notFound()`.
The sign-in keeps `next` in the address through its steps, takes it only when
it is a path of this site (`parseNext`), and goes there after a code or a
passkey (`afterSignIn`). The form works with no JavaScript: it posts to
`saveRecipeForm`, which checks the API's own rules first (`checkRecipe`, since
the API's 400 names no field), and on an error answers a 303 back with
`?error=&field=` and what was typed in `recipe_draft_0` to `_2` (`HttpOnly`,
5 minutes, `Secure` on HTTPS; a fourth would push the `Cookie` header past
what `vite dev` accepts). The draft names its form, `new` or the recipe's id,
and only that form's loader reads and deletes it, once the page shows the
form. The new recipe's page asks for the sign-in on load (`readSignedIn`), as
the other three do; a 401 on save sends to the sign-in with the draft kept.
An id that isn't a UUID is not found before the API is asked, so a 400 on an
edit is a body the API refuses and goes back to the form as a new recipe's
does. Ingredients and steps are rows: spare empty rows to add, a cleared row
to remove, and an `Orden` number to reorder. A recipe keeps its own language:
a new one takes the page's, an edited one sends back its own from a hidden
field, and its content carries its `lang`, which may not be the interface's.

**The home depends on the environment.** `homeOf` (`src/home/home-of.ts`)
picks it: the API's health in development and preview, the building page in
production, which reads no health and has no form, input or script of its own.
The health also has its own page in every environment, `/<lang>/health`, and
that is what the deploy's smoke reads (`scripts/check-web.ts`), whatever the
home shows; the smoke also checks that each home answers 200 with its `lang`
and, where indexing is blocked, `noindex`
(`docs/adr/2026-11-25-production-home-is-the-building-page.md`).

**Shared pieces live in `src/pieces/`**: the button, the text field, the
checkbox and the card, one file each. A piece is plain React with no router
and no server function, takes its texts as props, and is styled only from the
tokens. Anything only one feature uses stays in that feature's folder; a
piece moves to `src/pieces/` when a second feature needs it. A screen
arranges pieces and never picks a colour or a size of its own. Every piece is
shown in every state on the showcase page, `/en/showcase` and `/es/showcase`
(`src/showcase/`), which answers in development and preview and is 404 in
production, through `showcaseShown`: a new piece, or a new state of one, goes
there too.

**The API is called only from the web app's server**, inside a server
function or by the wake below, through
`createApiClient` from `@paste-and-taste/api-client` with `WebConfig.api`:
never a hand-written `fetch`, never a copied type, and never from the browser
(the API sends no CORS headers). `WebConfig.api` is the Service binding `API`
when deployed and `API_URL` over HTTP under `vite dev`; never call the
binding's `fetch` detached from it. A call catches `ApiError` and `ApiUnreachableError` and turns
them into states the view shows, with text from the translation files. Never
an error's own message, and never a stack trace.

**Logs.** Deployed, everything the web app's server logs is kept in Workers
Logs (`docs/adr/2026-11-25-logs-in-workers-logs.md`), so nothing our code logs
holds an email address, a sign-in code, a cookie or a session token.

**A page load wakes the database.** `src/server.ts` wraps Start's handler in
`withWake` (`src/wake/wake.ts`): a `GET` that asks for HTML and isn't under
`/_serverFn` sends the API's `GET /wake` beside the page, kept alive with the
Workers runtime's `waitUntil`, which `src/server.ts` imports from
`cloudflare:workers` and passes in. The page never awaits it, and a failed wake
is only logged on the server. Nothing is stored in the browser for it, and
nothing is remembered between requests: each page load sends one, the redirect
at `/` included. Server functions, the favicon and anything not asking for HTML
send none.

**Styles are Tailwind utilities from the tokens.** Every colour, font, text
size, radius, control size, duration, easing and animation is a token in
`src/styles/tokens.css`, named by its role, never by its value. A component
takes those only from the tokens' utilities (`bg-surface`, `text-text-muted`,
`rounded-control`, `duration-quick`): never a raw or arbitrary one like `bg-[#fff]` or
`duration-[300ms]`, never a variable like `animate-(--x)`, and never a number
Tailwind turns into a value with no token, like `duration-300`;
`test/showcase.test.tsx` fails on all three in the showcase page. Spacing
uses Tailwind's own scale; a control's height (`h-control`), the touch target
(`min-h-touch`) and the text sizes of `DESIGN.md` (`text-body`,
`text-small`) are tokens, and Tailwind's other type sizes stay. Tailwind's own
palette, fonts, radii, easings and animations are removed there, so
`bg-red-500` and `animate-spin` don't exist. Every colour has a light value in
`@theme static` and a dark one in the `prefers-color-scheme: dark` block after it, so
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
on its own. An animation is an `--animate-*` token with its `@keyframes` in
`tokens.css`, like the checkbox's `bounce` and `draw`: it takes its duration
from a duration token and fills `both`, and the element's own style is its
last frame, so with the durations at zero it shows that frame and doesn't
move. `test/tokens.test.ts` fails when an animation reads anything else, or a
duration token isn't zeroed for reduced motion. Page transitions, springs and
gestures come with the screens that need them: the Web Animations API, View
Transitions and a small spring of our own.

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
`APP_ENV` names the environment, `development`, `preview` or `production`, as
`WebConfig.environment`; preview and production both block indexing, so code
that differs between them reads this.

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
