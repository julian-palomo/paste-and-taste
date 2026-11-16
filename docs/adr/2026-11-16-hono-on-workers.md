# Hono for the API on Cloudflare Workers, with NestJS's structure by hand

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

[2026-11-15-nestjs-on-workers.md](2026-11-15-nestjs-on-workers.md) chose
NestJS on Workers on one condition: a real deploy of the bare skeleton. The
condition held. On 16 November 2026 the owner deployed #19's branch to a real
Worker, and the smoke script exited 0 against it.

The skeleton showed what NestJS on Workers costs:

- **A bridge.** NestJS runs as a Node server, so the Worker handed its Express
  instance to `httpServerHandler` from `cloudflare:node`, under
  `nodejs_compat`.
- **A compile step.** `tsc` built `dist/` before wrangler bundled it, because
  wrangler's bundler doesn't emit the decorator metadata NestJS injects by.
- **Stubs.** Five packages that NestJS imports lazily had to be aliased to a
  stub before the bundle would build.
- **No documentation.** Neither NestJS nor Cloudflare documents the
  combination, so the database, login and Workflows would each be an
  experiment.
- **Size.** 3331.51 KiB uncompressed, and 92.7 ms of startup measured
  locally.

The result is not NestJS as it is normally used, which weakens the reason it
was chosen: learning it. Hono is made for Workers, is what Cloudflare's own
guides use, and its app is the Worker's default export.

## Decision

The API is **Hono on Cloudflare Workers**. It keeps what NestJS's structure
teaches, applied by hand:

- **A composition root.** `createApp` in `apps/api/src/app.ts` validates the
  variables, creates every dependency and passes each to the modules that need
  it.
- **One module per feature.** Each module is a function that returns its
  routes.
- **Handlers that only translate HTTP.**
- **One place where an error becomes Problem Details.**

`.claude/rules/api.md` writes these conventions down.

## Alternatives considered

- **NestJS on Workers**, as deployed. Its deploy is proven, and the framework
  itself enforces modules and dependency injection instead of a rule file.
  It is also practice with NestJS's own API, which was the reason it was
  chosen. It lost on the bridge, the compile step and the stubs above, and on
  every later piece being undocumented.
- **NestJS on a Node host.** NestJS runs as documented, with no bridge or
  stubs, and every NestJS guide applies. It lost because it adds a second
  platform to run beside Cloudflare, where Workflows and the rest already
  live.

## Consequences

- **No practice with NestJS's own API.** This project no longer gives it:
  there are no decorators, no container and no NestJS modules.
- **The structure is a convention.** Hono enforces none of it, so it holds
  only as long as `.claude/rules/api.md` and the reviews keep it.
- **#9 is rewritten for Hono.** The API contract and the typed client are
  designed again with Hono's tools.
- **The pending checks now apply to Hono.**
  [2026-11-15-better-auth.md](2026-11-15-better-auth.md) and
  [2026-11-15-cloudflare-workflows.md](2026-11-15-cloudflare-workflows.md)
  name NestJS on Workers as an untested combination. Those records stay as
  they are; the checks they ask for now apply to Hono on Workers. Better Auth
  has a Workers example with Hono, by that record.
- **What the skeleton dropped.** It runs without `nodejs_compat`, without a
  compile step and without stubs. It bundles to 836.76 KiB, and its local
  startup profile is 37.4 ms. A dependency that needs Node APIs brings
  `nodejs_compat` back in its own change.
