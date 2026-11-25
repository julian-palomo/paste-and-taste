# Production's home is the building page, and the health moves to its own address

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Production's home, `/en` and `/es`, showed the API's health: its status and
environment. #88 will serve production at `pasteandtaste.app`, and the sign-in
emails already go out under the app's name, so people will open that address.
The owner, on 25 Nov 2026: "deberíamos de poner en producción una pantalla de
que estamos construyendo", then "sin formulario, sí el preview para nosotros".

The deploy's smoke read that same page in every environment
(`apps/web/scripts/check-web.ts`). Its status `ok` and environment name are how
a deploy proves the web app reached its API through the Service binding
([how the web app deploys](2026-11-23-how-the-web-app-deploys.md)). A production
home without the health would fail the smoke as it was written.

## Decision

- **Production's home is the building page:** the app's name, what it is, and
  that it is being built, in both languages, with no form, no input and no
  request to another site. Development and preview keep the health as their
  home. One function of the environment, `homeOf` (`apps/web/src/home/`),
  decides which.
- **The health moves to its own page, `/<lang>/health`**, in every environment,
  with the same view. The smoke reads the health there, with the same checks.
  It also checks that each home answers 200 with its language and, where
  indexing is blocked, `noindex`.
- **The wake stays on every page**, the building page included, as
  `.claude/rules/web.md` says: whoever opens a page finds the database awake.
- The page is text only; a drawing can come with the design's issue.

The owner chose it on 25 Nov 2026, in the plan on issue
[#98](https://github.com/julian-palomo/paste-and-taste/issues/98).

## Alternatives considered

- **A JSON route only for the smoke.** It would add a second way of reading
  the health. The smoke would also stop checking a page rendered on the
  server through the Service binding, which is what the deploy needs to prove.
- **Skipping the wake on the building page.** It would save a database wake
  per visit to a page nobody can use yet. But it adds an exception to the rule
  that every page load sends one. Production isn't indexed, so few visits are
  expected.

## Consequences

- `/<lang>/health` is reachable in production too. It shows only the API's
  status and environment name, which the API's own `/health` already shows.
- When the app opens, production's home changes again, by changing `homeOf`;
  the smoke doesn't depend on what the home shows.
