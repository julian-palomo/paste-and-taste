# Login behind the API's own routes, with its own limits

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Login is Better Auth with a code by email and an optional passkey
([the record](2026-11-25-login-without-a-password.md)). Better Auth brings its
own HTTP handler, with its own routes under `/api/auth/*`, its own client for
the browser, and its own limiter.

The API's contract is an OpenAPI document generated from the routes' schemas,
with a typed client generated from it
([the record](2026-11-16-api-contract-from-openapi.md)), and the web app calls
the API only from its server, through that client; the API sends no CORS
headers (`.claude/rules/web.md`).

Read in better-auth 1.7.27: the limiter and the origin check run only in
Better Auth's own router, and they count by IP and path, never by email
address. A call made on the server through `auth.api` skips both.

## Decision

The API declares its own login routes under `/login`, with `createRoute`, so
they are in `openapi.json` and the typed client like any other route. Each
route calls Better Auth on the server through `auth.api`, with one Better Auth
instance and one database client for the request, and relays the cookies
Better Auth sets. **Better Auth's handler is not mounted.** Better Auth's
errors become the app's own, with a status each.

The app keeps **its own limits**, in Postgres, in place of Better Auth's
limiter, which this design never runs: 3 codes per address per 15 minutes, 10
codes per IP per hour, and 60 of any other login POST per IP per hour. This
departs from the login record, which said Better Auth's limiter goes on.

The owner approved it on 25 Nov 2026, in the plan on issue
[#69](https://github.com/julian-palomo/paste-and-taste/issues/69).

## Alternatives considered

- **Mount Better Auth's handler, and use its client in the web app.** Less
  code in the API. It needs CORS or a proxy, changes the web app's rule that
  the API is called only through the typed client, and leaves routes outside
  the document, which the contract test would have to skip by a list.
- **Keep Better Auth's limiter.** It runs only in its own router, and has no
  count per address, which the login record asks for.
- **Counts in a Worker's memory.** Each isolate has its own, and Cloudflare
  drops isolates at will, so such a count promises no limit.

## Consequences

- Each login route is a few lines of the API's own, and changing Better Auth
  for something else would change those routes, not their clients.
- The web app's server relays the session cookie both ways, and passes the
  browser's IP in `cf-connecting-ip`; how a Worker sets that header on a
  Service-binding request was not checked, and is that issue's to check.
- Every limited request writes to Postgres once.
- "Mantener la sesión iniciada" is built in the API, since the routes are its
  own ([the record](2026-11-25-a-remembered-session-lasts-90-days.md)).
