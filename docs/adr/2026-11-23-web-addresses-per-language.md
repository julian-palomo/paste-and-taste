# The web app's addresses per language, and no i18n library yet

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The interface is in Spanish and English
([2026-11-15-spanish-and-english.md](2026-11-15-spanish-and-english.md)), and
the owner wants the web app's pages rendered on the server so that search
engines read them. A search engine indexes each language only if each has its
own address, and finds the other version through `hreflang` links. The first
page, the API's health, has about ten strings and no plurals or formatting.

## Decision

The owner decided, on the plan for the web app's skeleton:

- **Both languages have a prefix:** `/en/…` and `/es/…`. Any other prefix is a
  404.
- **`/` answers 302** to the visitor's language, chosen on the server from
  `Accept-Language`, with `Vary: Accept-Language`. **English** is the fallback
  when the browser asks for neither language.
- Each page links to both versions with `hreflang="en"` and `hreflang="es"`,
  and to `/` with `hreflang="x-default"`, all as absolute addresses.
- **No i18n library for now.** One JSON file per language, and a typed lookup
  in which English gives the shape, so a key missing in Spanish fails
  `typecheck`. Routing uses TanStack Router's own `$lang` path parameter.

## Alternatives considered

- **One language with no prefix.** It makes one language the special case in
  every link. Changing it later breaks addresses that are already indexed.
- **Spanish as the fallback.** It lost to English as the wider audience.
- **Paraglide** (`@inlang/paraglide-js`), which the
  [TanStack Router i18n guide](https://tanstack.com/router/latest/docs/guide/internationalization-i18n)
  pairs with the router: typed messages compiled to functions, with its own
  URL strategies and server middleware. It lost for now because it adds a
  compiler, a Vite plugin and a generated folder for ten strings, and its
  routing overlaps with the route parameter.

## Consequences

- `/` has no page of its own. A landing page for visitors who aren't logged in
  is a separate decision.
- The library is chosen once, when the native app needs translations too, so
  that both frontends share it. The JSON files carry over to most libraries.
- Plurals and number or date formatting, when a screen needs them, are written
  with `Intl` until that library arrives.
