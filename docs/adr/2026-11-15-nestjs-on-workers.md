# NestJS for the API, on Cloudflare Workers if a real deploy holds

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

The API is the centre of the project: the web app and the native app are its
clients. The July plan named Hono. The owner wants to learn NestJS and hasn't
used it before.

The rest of the project sits on Cloudflare. Neither Cloudflare nor NestJS
documents running NestJS on Workers.

A local test on 15 November 2026 ran a minimal NestJS 12.5.0 API, with the
Express adapter, under `wrangler dev` 4.162.0. It used the `nodejs_compat`
flag and `httpServerHandler` from `cloudflare:node`. A controller with an
injected service answered `GET`, `POST` with a JSON body, and a 404. The
bundle from `wrangler deploy --dry-run` was 519 KiB gzipped.

Not tested: a real deploy, validation, login, the database, or Workflows
called from inside NestJS.

## Decision

The API is built with **NestJS**, on **Cloudflare Workers**, on one condition:
the first step is deploying the bare skeleton to a real Worker. If that
fails, the fallbacks are NestJS on a Node host, or Hono on Workers.

## Alternatives considered

- **Hono.** Small, and documented on Workers. It lost because learning NestJS
  is one of the goals.
- **NestJS on a Node host from the start.** It keeps NestJS on the runtime it
  documents, but adds a second platform to run. It stays as a fallback.

## Consequences

- This is not a documented path, so each new piece (validation, login, the
  database, Workflows) is tried on Workers before anything depends on it.
- The local test had to stub packages NestJS loads lazily, `class-validator`
  and `class-transformer` among them, so validation needs another answer than
  NestJS's default pipe.
- The bundle size has to be watched against the Workers limits.
