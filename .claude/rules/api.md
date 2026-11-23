---
paths:
  - "apps/api/**"
---

# How the API is put together

Hono checks none of this; this rule and the reviews do. The record is
`docs/adr/2026-11-16-hono-on-workers.md`.

**The composition root.** `createApp` in `src/app.ts` builds the whole
application. It is the only code that reads the raw variables (through
`parseConfig`) or creates a dependency: the config today, a database client
or a service later. It passes each module what that module needs. Tests build
the application through the same function, with the variables they choose.

**A module** is one feature in one folder, `src/<feature>/`. It exports
`<feature>Routes(deps)`, which takes its dependencies as one typed argument and
returns an `OpenAPIHono` sub-app; `createApp` mounts it with `app.route()`. A
module never imports another module's internals, and never creates what it
depends on: if it needs something, it is an argument.

**A route is declared with its schemas.** Each route is a `createRoute` with a
zod schema per response, registered as a component with `.openapi("Name")`,
plus `...problemResponses` for its errors. The handler answers with
`c.json(body, status)`, the status written out, so `typecheck` rejects a body
its schema doesn't allow. The schema is the one source of the type, the
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
added: health has neither.

**Errors.** Raise an error by throwing a named subclass of `AppError`
(`src/errors/app-error.ts`), never by building an error response by hand.
`src/errors/problem-details.ts` is the one place an error becomes a response.
A module never sets `onError` or `notFound`: Hono calls `notFound` only on the
root app, and a sub-app's `onError` would bypass the conversion.

**Only the entry knows about Workers.** `src/worker.ts` is the only file that
imports from `cloudflare:*`. Everything else runs on Node, which is what lets
the tests build the real application without the Workers runtime. A binding
reaches a module the same way the config does: read in the entry, passed to
`createApp`.

**Node runs the sources directly** (the document script, the smoke script), so
relative imports carry `.ts` and only erasable syntax is used: no `enum`, no
parameter properties. `erasableSyntaxOnly` in `tsconfig.json` checks it.
