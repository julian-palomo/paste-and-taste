# Postgres on Neon through Hyperdrive, with Drizzle

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The app keeps its users and its recipes in Postgres, and the API is a
Cloudflare Worker ([the record](2026-11-16-hono-on-workers.md)), which reaches
a database through Hyperdrive. Login is Better Auth, with the users in that
same database ([the record](2026-11-15-better-auth.md)).

On 23 Nov 2026 the owner chose **Drizzle** as the library the API talks to
Postgres with, and narrowed the host to two: Neon on its Free plan and
PlanetScale Postgres on its smallest node, PS-5, at 5 USD a month. A spike
measured both from one Worker on the Workers Free plan, with both databases in
London, on 24 and 25 Nov 2026. The figures are in
[`docs/research/login-on-workers.md`](../research/login-on-workers.md). In
short:

- **Awake, they are the same**: a session read took a median of 82 ms on Neon
  and 84 ms on PlanetScale, over 50 requests each.
- **Neon's free compute sleeps** after 5 idle minutes, and that can't be
  turned off. The first read after 35 idle minutes took a median of 920 ms on
  Neon and 254 ms on PlanetScale, over 5 rounds each.
- **A cheap request sent on opening the app hides most of it**, the owner's
  idea: sent 2 seconds before, it brought Neon's first read to a median of
  189 ms.
- **Nothing hung** with a `pg` client and a Better Auth instance per request:
  500 requests in a row answered 200 on each host.

## Decision

The app's Postgres is on **Neon**, on its Free plan while the users are the
owner's friends, reached through **Hyperdrive** with **Drizzle** and `pg`, a
client per request. The web app and the native app send a cheap request that
touches the database when the app or any of its pages opens, if no such
request has been sent yet, so Neon is awake by the time the user does
something.

Drizzle is the owner's choice of 23 Nov 2026. The host was proposed because the
two answer equally fast once awake, the wake request covers most of the
difference on the first request, and it costs nothing until the app needs
more. The owner chose it on 25 Nov 2026, adding that the wake goes out from
any page, not only the first.

## Alternatives considered

- **PlanetScale Postgres, PS-5 single node.** Never sleeps, so no wake request
  is needed and its first read was 254 ms against Neon's 920; backups every 12
  hours and point-in-time restore. 5 USD a month, used or not, for a node of
  1/16 vCPU and 512 MiB that its own dashboard showed at 100 % memory with
  nothing calling it. It is where to go if the wake request turns out not to
  be enough, or to pay a fixed 5 USD for an always-on database.
- **Other hosts** were not measured. Supabase's free plan pauses a project
  after 7 days without use and needs a manual restore, as its page said on
  22 Nov 2026.
- **Kysely and Prisma**, instead of Drizzle. Bundled into a Worker on 22 Nov
  2026, Drizzle took 494 KiB, Kysely 720 KiB and Prisma 4,044 KiB. The owner
  chose Drizzle.

## Consequences

- **The first request after a quiet spell is slower**, by up to a second when
  the wake request hasn't had time to land. The apps have to send that
  request, and it is one more thing to keep working.
- **The free plan has edges to watch**: 100 CU-hours and 1 GB a month for the
  project, after which the compute is suspended until the next month or an
  upgrade; and a history of 6 hours with one manual snapshot, which is thin
  once the recipes matter. The report's "How it grows" lists the signs that it
  is time to pay, and what paying costs on each host.
- **Changing host stays possible**: both are plain Postgres, so it is a dump,
  a restore and a Hyperdrive configuration pointed at the new database, as
  long as the app uses no extension only one host has. It was not tried.
- **A client per request, never at module scope.** A Better Auth instance or a
  `pg` client shared between requests leaves the next ones hung.
- **Hyperdrive's cache is a choice still to make.** The spike ran with it
  disabled. On, it serves a read from its cache for about a minute, and a
  write does not clear it.
- **Where the Hyperdrive id lives is open**: Cloudflare's pages don't say
  whether it is sensitive, and the deploy token may need a Hyperdrive
  permission that was only read about, not tried.
- **How users sign in has its own record.** A request that hashes a
  password took a median of 88 to 158 ms of CPU, against the 10 ms the Workers
  Free plan allows, so login has no password
  ([the record](2026-11-25-login-without-a-password.md)), and the Workers plan
  has its own record too
  ([the record](2026-11-25-workers-free-until-login-ships.md)).
