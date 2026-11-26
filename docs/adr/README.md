# Architecture decision records

This folder keeps a short record of every decision that shapes the project:
what was chosen, what else was looked at, and what the choice costs. When
someone opens the code later and wonders why it is the way it is, the answer
is here, written down at the time instead of remembered afterwards.

## How it works

- **One file per decision**, named with the date first and a short slug, for
  example `2026-11-15-better-auth.md`. Sorting by name sorts by date.
- **Use [`template.md`](template.md)**: context, decision, alternatives
  considered, consequences.
- **A decision has alternatives.** What the app must do, with no choice
  between options behind it, is a requirement and lives in
  [`../product.md`](../product.md) and in the issues.
- **Records are history.** Once a decision is accepted, its file isn't
  rewritten. A change of mind is a new ADR, and the old one gets a single
  line at the top: `Superseded by <new file>`.
- **Short is fine.** A good ADR is a page, not an essay.

## Decisions so far

| Date       | Decision                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-11-14 | [A monorepo with a native app, a web app and an API](2026-11-14-monorepo-with-a-native-app.md)               |
| 2026-11-14 | [TanStack Start for the web app](2026-11-14-tanstack-start-for-the-web.md)                                   |
| 2026-11-14 | [An import limit kept per user, and no paid plan](2026-11-14-import-limit-per-user.md)                       |
| 2026-11-15 | [NestJS for the API, on Cloudflare Workers if a real deploy holds](2026-11-15-nestjs-on-workers.md)          |
| 2026-11-15 | [Better Auth for login](2026-11-15-better-auth.md)                                                           |
| 2026-11-15 | [Cloudflare Workflows for background work](2026-11-15-cloudflare-workflows.md)                               |
| 2026-11-15 | [No notes field: a note edits the recipe](2026-11-15-a-note-edits-the-recipe.md)                             |
| 2026-11-15 | [The interface in Spanish and English from day one](2026-11-15-spanish-and-english.md)                       |
| 2026-11-15 | [The issue carries the spec, and a local reviewer approves the plan](2026-11-15-the-issue-carries-the-spec.md) |
| 2026-11-15 | [A model per agent](2026-11-15-a-model-per-agent.md)                                                         |
| 2026-11-15 | [The reviewer applies the fixes only when they close the review](2026-11-15-fixes-after-a-review.md)         |
| 2026-11-15 | [Every plan is reviewed, the owner's too](2026-11-15-every-plan-is-reviewed.md)                              |
| 2026-11-15 | [pnpm workspaces and Turborepo](2026-11-15-pnpm-and-turborepo.md)                                            |
| 2026-11-15 | [The plan reviewer reads the web, and the owner's plans get a review that runs](2026-11-15-owner-plans-get-a-review-that-runs.md) |
| 2026-11-15 | [How the API deploys](2026-11-15-how-the-api-deploys.md)                                                      |
| 2026-11-16 | [Hono for the API on Cloudflare Workers, with NestJS's structure by hand](2026-11-16-hono-on-workers.md) |
| 2026-11-16 | [The API's contract: an OpenAPI document, and a client generated from it](2026-11-16-api-contract-from-openapi.md) |
| 2026-11-16 | [How an Instagram post is read](2026-11-16-how-an-instagram-post-is-read.md) (Proposed)                     |
| 2026-11-23 | [ApiUnreachableError when no usable answer comes back from the API](2026-11-23-api-unreachable-error.md) |
| 2026-11-23 | [The web app's addresses per language, and no i18n library yet](2026-11-23-web-addresses-per-language.md) |
| 2026-11-23 | [How the web app deploys, and how its server reaches the API](2026-11-23-how-the-web-app-deploys.md) |
| 2026-11-23 | [Tailwind CSS 4 from one tokens file, and motion without a library](2026-11-23-tailwind-and-css-motion.md) |
| 2026-11-23 | [The app's look: a basil green, Outfit and Nunito Sans, flat food and utensils](2026-11-23-the-apps-look.md) |
| 2026-11-24 | [The typefaces served by the app, and dark mode from the device](2026-11-24-fonts-from-the-app-and-dark-mode-from-the-device.md) |
| 2026-11-24 | [Friends and groups, and a copy for whoever keeps a recipe](2026-11-24-friends-groups-and-copies.md) |
| 2026-11-24 | [A recipe shared by link can be read without an account](2026-11-24-a-shared-link-is-readable-without-an-account.md) |
| 2026-11-24 | [The conversation hangs from the recipe](2026-11-24-the-conversation-hangs-from-the-recipe.md) |
| 2026-11-24 | [Recipes are organised with tags, not folders](2026-11-24-tags-not-folders.md) |
| 2026-11-24 | [The AI provider and the SDK for the import](2026-11-24-the-ai-provider-and-sdk.md) (Proposed) |
| 2026-11-24 | [Staying signed in: an unchecked box, and no cookie banner](2026-11-24-staying-signed-in.md) |
| 2026-11-25 | [Postgres on Neon through Hyperdrive, with Drizzle](2026-11-25-database-host-and-drizzle.md) |
| 2026-11-25 | [Login without a password: a code by email and an optional passkey](2026-11-25-login-without-a-password.md) |
| 2026-11-25 | [Workers Free until the real login is deployed, then Workers Paid](2026-11-25-workers-free-until-login-ships.md) |
| 2026-11-25 | [Opus reviews when Fable is out of credits](2026-11-25-opus-reviews-when-fable-is-out.md) |
| 2026-11-25 | [A remembered session lasts 90 days from its last use](2026-11-25-a-remembered-session-lasts-90-days.md) |
| 2026-11-25 | [Login behind the API's own routes, with its own limits](2026-11-25-login-behind-the-apis-own-routes.md) |
| 2026-11-25 | [The deployed Workers' logs are kept in Workers Logs, with a line per request only in preview](2026-11-25-logs-in-workers-logs.md) |
| 2026-11-25 | [A recipe's ingredients and steps as jsonb in its own row](2026-11-25-ingredients-and-steps-as-jsonb.md) |
| 2026-11-25 | [Resend sends the sign-in code, from the app's own subdomain](2026-11-25-resend-for-the-sign-in-code.md) |
| 2026-11-25 | [The login's expired rows are deleted once a day, by a Cron Trigger](2026-11-25-how-long-login-rows-live.md) |
| 2026-11-25 | [Production's home is the building page, and the health moves to its own address](2026-11-25-production-home-is-the-building-page.md) |
| 2026-11-25 | [A deleted recipe is removed at once, and the delete answers 204](2026-11-25-deleting-a-recipe.md) |
| 2026-11-25 | [The Workers answer on pasteandtaste.app, and production stays unindexed until launch](2026-11-25-the-apps-own-domain.md) |
| 2026-11-26 | [The app's name is Paste & Taste](2026-11-26-the-name-is-paste-and-taste.md) |

## Not decided yet

Each of these gets its ADR when it is decided, not before.

- How an Instagram post is read. The requirement is one tap, including the
  video and the carousel images. The prototype measured the routes; its
  [record](2026-11-16-how-an-instagram-post-is-read.md) is Proposed and
  recommends the public embed view, and the owner decides.
- The AI provider and the SDK that calls it. The prototype measured three
  candidates; its [record](2026-11-24-the-ai-provider-and-sdk.md) is Proposed
  and recommends Gemini reading the video, with Google's SDK, and the owner
  decides.
- Reading YouTube videos with a model.
- The licence, the mark, what a rating means, and whether the app ever
  charges.
