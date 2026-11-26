---
paths:
  - "apps/api/**"
---

# How the API is put together

Hono checks none of this; this rule and the reviews do. The record is
`docs/adr/2026-11-16-hono-on-workers.md`.

**The composition root.** `createApp` in `src/app.ts` builds the whole
application. It, and `createScheduledWork` beside it for the cron, are the
only code that reads the raw variables (through
`parseConfig`) or creates a dependency: the config, the database, a service.
It passes each module what that module needs. Tests build the application
through the same function, with the variables and the database they choose.

**A resource that lives for one request**, such as a database client, is never
created at module scope or in `createApp`: a client shared between requests
leaves the next ones hung on Workers. `createApp` takes the database as a
`DatabaseSource`, which `src/worker.ts` builds from the Hyperdrive binding,
and hands a module `withDatabase`, which opens a client, runs the work under
one deadline and closes the client before it returns
(`src/database/database.ts`). Only a failed connect or the deadline becomes a
503 `DatabaseUnavailableError`; an error the work throws comes back as it is,
so a repository's own `AppError` keeps its status. Tests pass a real Postgres from
`test/postgres.ts`, or `noDatabase` when the routes they call don't touch it.

**A library behind a module.** A library the app doesn't own, such as Better
Auth, lives inside one module and never shapes the contract: the module
declares its own routes with `createRoute` and calls the library on the
server, one instance per request, built from that request's database client.
What the library throws is turned into the module's `AppError`s in one place;
what it doesn't expect is rethrown, a 500. What travels outside the API, such
as the sender of a sign-in code, is a dependency `createApp` creates (or a
test passes in its third argument), so swapping it touches nothing else.
`src/login/` is the model.

**Who is signed in.** A module that needs the user declares the function it
needs (`src/recipes/current-user.ts`), and `createApp` gives it one built by
the login (`src/login/session-reader.ts`), so the module never imports the
login. It runs as the module's first middleware, before the routes'
validators, so a request with no session is a 401 whatever its body; and it
relays the cookie of a renewed session. `src/recipes/` is the model of a
service and a repository: the service depends on the `RecipesRepository`
type, the Postgres implementation is built in `createApp`, and the service's
tests use one written for the test.

**The tables** are a Drizzle schema in `src/database/schema.ts`. After any
change, `pnpm -C apps/api db:generate` writes the migration to `drizzle/`,
which is committed and never edited. Only the owner applies migrations to a
real database.

**A module** is one feature in one folder, `src/<feature>/`. It exports
`<feature>Routes(deps)`, which takes its dependencies as one typed argument and
returns an `OpenAPIHono` sub-app; `createApp` mounts it with `app.route()`. A
module never imports another module's internals, and never creates what it
depends on: if it needs something, it is an argument.

**A route is declared with its schemas.** Each route is a `createRoute` with a
zod schema per response, registered as a component with `.openapi("Name")`,
plus `...problemResponses` for its errors. The handler answers with
`c.json(body, status)`, the status written out, so `typecheck` rejects a body
its schema doesn't allow. A success with no body, such as a delete's 204, is
documented with a description and no `content`, and answered with
`c.body(null, status)`. That widens the handler's type to any `Response`, so
for that route `typecheck` checks nothing, and the contract test checks that
the body is empty. The schema is the one source of the type, the
document (`openapi.json`) and the client's types: after changing a route, run
`pnpm -C apps/api openapi` and `pnpm -C tools/openapi-typegen generate`, and
commit both outputs. `pnpm contract:check` fails until you do.

**The contract test owes each route a request.** `test/contract.test.ts` calls
every operation in `openapi.json` and accepts only a 2xx that the operation
documents by its number: `default` never stands in for the success response.
A new route adds an entry to `successfulRequests` there, keyed
`"<method> <path>"` as the document writes them, with a request that makes it
succeed: the path with its parameters filled in, and the body and headers it
needs. Until it does, the contract test fails and names the route.

**A handler only translates HTTP.** It reads the request, calls the module's
code and shapes the response. Rules about the domain don't live in a handler.

**Services and repositories.** When a feature has logic, it goes in a service;
when it has data, a repository. Both live in the feature's folder, are created
in `createApp` and passed to the module. A layer with nothing in it is not
added: health and wake have neither.

**Errors.** Raise an error by throwing a named subclass of `AppError`
(`src/errors/app-error.ts`), never by building an error response by hand.
`src/errors/problem-details.ts` is the one place an error becomes a response.
It builds it through the request's context, so headers a middleware already
set, such as a renewed session's cookie, go out with the error too.
A module never sets `onError` or `notFound`: Hono calls `notFound` only on the
root app, and a sub-app's `onError` would bypass the conversion.

**Logs.** Deployed, everything the API logs is kept in Workers Logs
(`docs/adr/2026-11-25-logs-in-workers-logs.md`), so nothing our code logs
holds an email address, a sign-in code, a cookie or a session token, and an
unexpected error is logged only through `loggableError`
(`src/errors/loggable-error.ts`). The one exception is the development code
sender, `src/login/code-sender.ts`, which prints the code to the local
terminal where login runs, never to a deployed Worker. The Resend sender logs
a failure as Resend's status and error name only, and the daily ceiling on
codes logs that it is reached, with its number and nothing else.

**The sign-in code is sent by our route, not by Better Auth.** Better Auth
calls its sender through a function that catches and only logs any error, so
a send made there that failed would still answer "sent". Its callback only
puts the code in the request's outbox (`src/login/outbox.ts`); `POST
/login/code` sends it after `withAuth` returns, once the database client is
closed, through the `CodeSender` that `chooseCodeSender` picked. A failure
answers 502.

**Work on a schedule.** The Worker's Cron Trigger (`wrangler.jsonc`) runs
`createScheduledWork`, built in `src/app.ts` beside `createApp` from the same
variables and database, so it follows the same composition rules: it reads
the config once, opens its database through `withDatabase`, and logs counts,
never values. It runs only where the login is mounted, through the same
`loginIsMounted`. `src/worker.ts` exports `fetch` and `scheduled`, each built
at start-up. Tests call `createScheduledWork`, as they call `createApp`.

**Only the entry knows about Workers.** `src/worker.ts` is the only file that
imports from `cloudflare:*`. Everything else runs on Node, which is what lets
the tests build the real application without the Workers runtime. A binding
reaches a module the same way the config does: read in the entry, passed to
`createApp`.

**Node runs the sources directly** (the document script, the smoke script), so
relative imports carry `.ts` and only erasable syntax is used: no `enum`, no
parameter properties. `erasableSyntaxOnly` in `tsconfig.json` checks it.
