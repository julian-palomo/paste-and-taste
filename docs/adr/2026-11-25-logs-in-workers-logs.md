# The deployed Workers' logs are kept in Workers Logs, with a line per request only in preview

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Neither deployed Worker kept its logs: what the API and the web app wrote
could be read only while someone had `wrangler tail` open. On 25 November
2026 a preview deploy's `/wake` answered 503, and there was nothing to read
afterwards.

Cloudflare keeps a Worker's logs when its config turns on `observability`
([Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)).
Besides the lines the code logs, it can keep an invocation log for every
request: "details such as the Request, Response, and related metadata". That
page names no fields and no redaction. The
[Tail handler page](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/)
gives a tail event's request as `cf`, `headers`, `method` and `url`, and
replaces the value of `cookie`, `set-cookie` and any header whose name
contains auth, key, secret, token or jwt with "REDACTED". No rule there
covers `cf-connecting-ip`, the visitor's IP, and the `cf` object holds the
visitor's city, postal code, latitude and longitude
([Request page](https://developers.cloudflare.com/workers/runtime-apis/request/)).
No page says invocation logs follow the tail rules.

The app keeps as little about a person as it can (`docs/product.md`,
"Privacy").

## Decision

Both Workers keep their logs in Workers Logs, every request sampled. The
invocation logs are off at the top level, which production inherits, so
production keeps only the lines our code logs. Preview, visited only by the
owner and CI, turns them on.

Our code never logs an email address, a sign-in code, a cookie or a session
token. In the API an unexpected error is logged through `loggableError`,
which drops a failed query's params and keeps only the name and code of its
Postgres cause, with the request's method and path and nothing else from it.

## Alternatives considered

- **No kept logs**, as before: a failure after a deploy leaves nothing to
  read once the moment has passed.
- **Logpush or OpenTelemetry export to another service:** one more account
  and one more place that holds the logs, for a project with two Workers and
  one person reading them.
- **A third-party logger in the code:** a dependency in both Workers, and the
  same data question, with the data in someone else's hands.
- **Invocation logs on everywhere:** every production visitor's IP and rough
  location could be kept for up to seven days.
- **Invocation logs off everywhere:** preview would also keep nothing for a
  request that succeeds, such as a slow wake.

## Consequences

- Logs are kept seven days at most. On the Free plan, from 1 December 2026,
  nothing more is kept for the rest of the day once 0.5 GB is used
  ([pricing](https://developers.cloudflare.com/observability/pricing/)).
- In production a request that succeeds leaves no line, so a slow but
  successful request has nothing to read.
- Cloudflare's redaction can't be configured. Which fields a preview
  invocation log holds is checked once, after the merge, by reading one in
  the dashboard and noting the field names only: whether `cookie` shows as
  REDACTED, and whether `cf-connecting-ip` and the `cf` location fields are
  there.
- A new `console.*` line in either Worker is kept too, so what it logs falls
  under the rule above.
