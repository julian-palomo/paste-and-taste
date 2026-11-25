# The typefaces served by the app, and dark mode from the device

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

[`DESIGN.md`](../../DESIGN.md) gives the app a basil palette in light and in
dark, Outfit for titles and Nunito Sans for text, and left open how the two
typefaces are served and what turns the dark mode on
([the look's record](2026-11-23-the-apps-look.md)). Every value lives in
`apps/web/src/styles/tokens.css` under a role name
([the styling record](2026-11-23-tailwind-and-css-motion.md)). Pages are
rendered on the server, and the owner dislikes a page that changes after it
is drawn. English and Spanish need only the Latin characters.

## Decision

The owner decided, on 24 November 2026, with the plan of issue #54:

- **The typefaces are served by the app**, from its own origin, as the
  owner's personal site does. The files come from the Fontsource variable
  packages `@fontsource-variable/outfit` and
  `@fontsource-variable/nunito-sans` (5.3.0, OFL-1.1): only each one's Latin
  weight-axis file, about 32 KB each. `src/styles/fonts.css` declares them
  with its own `@font-face` rules, under the names `Outfit` and
  `Nunito Sans`; the packages' CSS, which calls them `Outfit Variable` and
  `Nunito Sans Variable`, isn't imported.
- **A typeface is drawn only if it is ready for the first paint**:
  `font-display: optional`, and the root's `<head>` preloads both files so
  they are fetched with the stylesheet.
- **Hashed files are cached for a year.** `apps/web/public/_headers` gives
  `/assets/*` `Cache-Control: public, max-age=31536000, immutable`, so a
  cached font is used with no request. Without it Workers Static Assets sends
  `public, max-age=0, must-revalidate`, and every load asks the server again
  before drawing.
- **Dark mode follows the device** (`prefers-color-scheme`) and nothing else.
  The dark values are one block in `tokens.css` that redeclares every colour
  token and `color-scheme`; a switch inside the app would add its selector to
  that block and rename nothing.
- **`focus` is the accent of each mode**, `#3B7A1E` and `#8FD46A`.

## Alternatives considered

- **Google Fonts.** Every page would ask another host, and the owner's site
  doesn't.
- **The Fontsource packages' own CSS.** It sets `font-display: swap` and adds
  the Latin Extended files, which the app doesn't need.
- **`font-display: swap`**, alone or with a fallback whose metrics are
  adjusted to the typeface. The text changes in front of the reader; the
  adjusted fallback avoids the layout shift, but not the change of letter
  shapes.
- **CSS `light-dark()` in each token**: one list instead of two sets, but it
  needs Safari 17.5, and in an older browser the token becomes invalid
  instead of falling back to light.
- **A switch inside the app now.** Out of scope; the tokens are declared so
  that it needs no rename.

## Consequences

- When a file misses the first paint, the page stays in the system's
  typeface. Measured in Chrome on 24 November 2026, against
  `pnpm -C apps/web dev` at 400 kbit/s with 400 ms of latency: the first
  paint used the system's typeface, and nothing changed afterwards, with no
  layout shift. Nodes added to the same document after both files had
  arrived were drawn in the system's typeface too. A navigation with no full
  reload adds nodes to the same document, so it keeps the system's typeface
  until a full load. That was measured by adding nodes, not with a router
  navigation, which the app doesn't have yet.
- The next full load draws the typefaces if the cached files can be used with
  no request. Under `vite dev`, which sends no `Cache-Control`, each file was
  revalidated (304) and the reload at that latency still drew the system's
  typeface. The year-long cache of `/assets/*` is what lets a deployed page
  use the cached files at once. That header on Cloudflare is checked after
  the deploy.
- `_headers` must cover only files with a content hash in their name: a
  browser keeps anything it matches for a year without asking.
- A new colour token needs a light and a dark value; `apps/web/test/tokens.test.ts`
  fails when the two sets name different tokens, and checks each pair's
  contrast in both modes.
