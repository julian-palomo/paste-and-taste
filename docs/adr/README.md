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
| 2026-11-15 | [How the API deploys](2026-11-15-how-the-api-deploys.md) (Proposed)                                           |

## Not decided yet

Each of these gets its ADR when it is decided, not before.

- How an Instagram post is read. The requirement is one tap, including the
  video and the carousel images; how it is done waits for the prototype.
- The database host and the ORM. Postgres is the preference.
- How the API deploys. Its record is Proposed and recommends a GitHub Actions
  job; the owner decides, and the pipeline is its own issue.
- The AI provider and the SDK that calls it.
- Reading YouTube videos with a model.
- The licence, the final name, what a rating means, and whether the app ever
  charges.
