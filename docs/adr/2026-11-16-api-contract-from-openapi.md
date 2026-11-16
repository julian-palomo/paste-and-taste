# The API's contract: an OpenAPI document, and a client generated from it

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The API has two clients to come, a web app and a native app
([2026-11-14-monorepo-with-a-native-app.md](2026-11-14-monorepo-with-a-native-app.md)).
Types written by hand in each would drift from the API. The API is Hono on
Workers ([2026-11-16-hono-on-workers.md](2026-11-16-hono-on-workers.md)), and
its configuration is already validated with zod.

Facts checked on 16 November 2026, in a scratch project and on npm:

- `openapi-typescript` 7.13.0 (last release February 2026, peer
  `typescript@^5.x`) crashes when the installed TypeScript is 7.0.2, the
  catalog's: TypeScript 7 doesn't ship the compiler API it builds with. It
  runs from a package with its own TypeScript 5.9.3, and the types it writes
  typecheck under 7.0.2.
- With `@hono/zod-openapi` 1.6.3, a handler that returns a body its response
  schema doesn't allow is a compile error (TS2322), as long as the handler
  writes its status (`c.json(body, 200)`). An extra property isn't caught.

## Decision

The owner decided that the client's types come from an **OpenAPI document**,
not from Hono's own typed client. The pieces:

- **zod** describes each route's response. It is one schema for the type, the
  document's entry and the runtime validation in the contract test, and the
  same library as the configuration.
- **`@hono/zod-openapi`** declares the routes (`createRoute`) and writes the
  document, `apps/api/openapi.json`, from a Node script.
- **`openapi-typescript`** writes the client's types from the document, run
  from `tools/openapi-typegen` with its own TypeScript 5.9.3 (the pnpm catalog
  `typegen`).
- **`openapi-fetch`** makes the calls in `packages/api-client`, behind
  `createApiClient`. Every failure is thrown as `ApiError`.
- **`@cfworker/json-schema`** validates the real application's responses
  against the document in the contract test.

`pnpm contract:check`, in `pnpm verify` and CI's `Contract` job, fails when the
document or the types are stale.

## Alternatives considered

- **Hono's typed client (RPC).** No document and no generator, and the caller
  sees the handler's types directly. It lost because it serves only
  TypeScript callers, while OpenAPI is a standard any language's tools read.
  It would also be a second description of the API beside the document this
  project needs anyway. It still typechecks against an app built with
  `@hono/zod-openapi`, so the choice can be revisited.
- **`hono-openapi`** to write the document. It works with any Standard Schema
  library, valibot included. It lost because a handler returning the wrong
  shape still compiles, and its 1.6.0 needs a bundler alias to build for the
  Worker.
- **`orval`** to generate the client. It needs no second TypeScript. It lost
  on weight (about twenty `@orval/*` packages and generated runtime code), and
  calls through it were never run.
- **`ajv`** for the contract test. It is the most used validator. It lost to
  `@cfworker/json-schema`, which supports the same 2020-12 dialect with no
  dependencies.

## Consequences

- **A second TypeScript.** The repo holds 5.9.3 beside 7.0.2, only to run the
  generator. It goes when `openapi-typescript` runs on TypeScript 7.
- **The route definitions ship in the Worker.** So does `OpenAPIHono`'s
  `getOpenAPI31Document`, even though only the Node script calls it. The
  dry-run grew from 836.76 KiB to 920.08 KiB (gzip 136.06 to 152.62 KiB) for
  the one route there is.
- **Two generated files to commit after changing a route.** They are
  `openapi.json` and `schema.d.ts`; `contract:check` fails until both are
  committed.
- **Node runs `apps/api`'s sources directly**, so its relative imports carry
  `.ts` and `erasableSyntaxOnly` keeps out syntax Node can't strip.
- **The client never trusts an error body's shape.** `ApiError.status` is the
  response's, and a body that isn't Problem Details (a gateway's HTML page)
  becomes a problem built from that status.
