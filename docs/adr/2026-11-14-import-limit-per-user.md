# An import limit kept per user, and no paid plan

- **Status:** Accepted
- **Date:** 2026-11-14

## Context

Importing a recipe with a model costs money on every use. A first estimate on
14 November 2026, from a single 90-second video, put one import between about
$0.002 and about $0.025 depending on the services used. Token counts were
assumed, not measured.

The apps that already import from social networks give a few free imports and
charge for more.

## Decision

Each user has an import limit, stored as data on the user. There are premium
users, and the owner has no limit. The app is not paid. Whether it ever
charges is not decided.

## Alternatives considered

- **No limit.** One heavy user, or one script, sets the bill.
- **One limit for everyone, in the code.** It can't tell a premium user from
  the rest without a deploy.
- **A paid plan from the start.** Payments are a project of their own, and
  nobody uses the app yet.

## Consequences

- Imports are counted per user from the first one.
- No payment code is written until charging is decided.
- A limit per user doesn't cap the total spend. That needs its own answer.
