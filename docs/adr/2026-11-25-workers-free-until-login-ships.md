# Workers Free until the real login is deployed, then Workers Paid

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The API and the web app are Workers on the Workers Free plan, which allows
10 ms of CPU a request. Reading a session took a median of 8 ms, and signing
in without a password 10 ms, the limit itself
([the report](../research/passwordless-login.md)). Cloudflare lets a Worker
run over now and then, and terminates one that "starts hitting the limit
consistently"
([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).

Workers Paid costs a minimum of 5 USD a month for the whole Cloudflare
account, with 10 million requests and 30 million CPU milliseconds included,
and a limit of 30 seconds of CPU a request
([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
read on 25 Nov 2026). The owner's other projects are in the same account, so
they share it.

## Decision

The account stays on **Workers Free** until the app's real login is deployed,
and moves to **Workers Paid** then.

The owner chose it on 25 Nov 2026.

## Alternatives considered

- **Workers Paid now.** Nothing deployed today needs it: the API and the web
  app have no login yet.
- **Workers Free with the login.** Every request with a session would run at
  the limit, and how Cloudflare treats that under steady traffic wasn't
  measured.

## Consequences

- The issue that deploys the login includes moving to Workers Paid, which the
  owner does in the Cloudflare dashboard.
- Until then, a feature that needs more CPU than the free plan allows waits
  for it, or brings the move forward.
