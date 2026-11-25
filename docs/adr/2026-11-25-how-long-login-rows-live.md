# The login's expired rows are deleted once a day, by a Cron Trigger

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The login keeps three kinds of row that outlive their use:

- `request_limit`, one row per key, and a key names who it counts: an email
  address or an IP;
- `verification`, Better Auth's, which holds a sign-in code or a passkey
  challenge until its `expires_at`;
- `session`, Better Auth's, until its `expires_at`.

The app keeps as little about a person as it can (`docs/product.md`,
"Privacy").

Better Auth 1.7.27 deletes some of these on its own, but only when there is
traffic:

- **Expired `verification` rows:** only when a verification value is looked
  up, at most once a minute per isolate (`dist/db/internal-adapter.mjs`, lines
  19 and 803-818).
- **An expired session:** only when its own cookie comes back
  (`dist/api/routes/session.mjs`, lines 155-163).
- **`request_limit`** is the app's own table, and nothing deleted it.

Costs, read on 25 Nov 2026:

- **Workers Free**
  ([limits](https://developers.cloudflare.com/workers/platform/limits/),
  [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)):
  - 10 ms of CPU for a Cron Trigger, as for a request;
  - 5 Cron Triggers per account, shared with the owner's other projects.
  - Whether a cron invocation counts toward the 100,000 requests a day isn't
    stated.
- **Neon Free** ([plans](https://neon.com/docs/introduction/plans),
  [scale to zero](https://neon.com/docs/introduction/scale-to-zero)):
  - 100 CU-hours per project a month;
  - the compute scales to zero after 5 minutes idle, fixed on Free.
  - So a wake costs about 5 minutes running: ~0.021 CU-h at 0.25 CU.

## Decision

**What is deleted.** `deleteExpiredLoginRows`
(`apps/api/src/login/expired-rows.repository.ts`) deletes:

- `verification` and `session` rows with `expires_at < now`, Better Auth's
  own test;
- `request_limit` rows whose window started at least the longest window in
  `LIMITS` ago, today 1 hour. Such a window has ended under every rule, so the
  next request would count from 1 either way, and no window that is still
  counting is reset.

**When it runs:** a Cron Trigger once a day, at 03:17 UTC, the owner's choice.

- **Bound:** an expired code or session is gone within 24 hours of
  expiring, and a limit row within 25 hours of its window starting.
- **Cost where the login runs:** one database wake a day, about 0.65 CU-h a
  month, 0.65 % of Neon Free.

**Where it runs.** The trigger is at the top level of
`apps/api/wrangler.jsonc`, so preview and production inherit it.

- The run deletes only where the login is mounted, under the same condition,
  `loginIsMounted`. Elsewhere it returns without opening a database client.
- It logs one line of counts, never a key, an address, a code or a token.

## Alternatives considered

- **Deleting beside the login's writes**, in `POST /login/code`:
  - no extra wake, but no bound when nobody signs in;
  - three more statements in a request that already runs at the 10 ms CPU
    limit (`2026-11-25-workers-free-until-login-ships.md`).
- **Both:** more code, for a gain only under traffic.
- **An hourly cron:** a 1-hour bound for up to 24 wakes a day, ~15 CU-h a
  month, for rows that are refused anyway once expired.
- **One cutoff per limit rule:** `code:email` rows would go 45 minutes
  sooner, against a bound of a day, at the cost of parsing keys.
- **The trigger left out until the login is deployed:** nothing would change
  on Cloudflare now, but the issue that deploys the login would owe it.

## Consequences

- Preview and production run the cron once a day each and do nothing until
  the login is mounted there. In preview, Cloudflare writes an invocation
  line per run, since it keeps a line per request there.
- The account has two of its five Cron Triggers in use by this Worker's two
  environments.
- A schedule change takes up to 15 minutes to reach Cloudflare's network.
- A local run is manual: `wrangler dev` never fires the cron on its own
  (`docs/deploying-the-api.md`).
