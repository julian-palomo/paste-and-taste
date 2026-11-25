# Login with Better Auth on a Worker on the free plan, on Neon and on PlanetScale

A spike's report: whether login with Better Auth holds on a Cloudflare Worker
on the free plan when its users live in Postgres reached through Hyperdrive
with Drizzle, and how the two hosts the owner is choosing between compare:
Neon's free plan and PlanetScale's smallest node. The code is throwaway, in
[`prototypes/login`](../../prototypes/login/README.md); this report stays. The
decision it informs is proposed in
[`docs/adr/2026-11-25-database-host-and-drizzle.md`](../adr/2026-11-25-database-host-and-drizzle.md).

Every figure is a measurement unless it says it is an estimate or a reading by
eye. A time in milliseconds is the whole request as timed on the owner's
machine, unless it says CPU.

## The short answer

- **Sign-in with a password does not fit the free plan.** A request that
  hashes a password took a median of 88 to 158 ms of CPU, against a limit of
  10 ms, and Cloudflare cut 32 of the 120 that did. Reading a session took a
  median of 8 ms.
- **The two hosts answer equally fast once awake**: a median of 82 ms on Neon
  and 84 ms on PlanetScale.
- **Neon's free compute does sleep, and the first request pays for it**: a
  median of 920 ms after 35 idle minutes, against 254 ms on PlanetScale, which
  never sleeps.
- **The owner's idea works.** A cheap request sent 2 seconds before brought
  that first read down to a median of 189 ms.
- **Nothing hung**: 500 requests in a row answered 200 on each host.
- The whole spike cost 0.14 USD, all of it PlanetScale's.

## How it was measured

- **One Worker, two hosts.** `paste-and-taste-login-spike`, deployed by the
  owner on the Workers Free plan on 24 Nov 2026. The first path segment picks
  the database, `/neon/...` or `/planetscale/...`, each through its own
  Hyperdrive configuration with the cache disabled; the code and the versions
  are the same for both.
- **Per request**, a new `pg` client on the binding's connection string and a
  new Better Auth instance, and the client is closed after the response.
- **The databases.** A Neon project on the Free plan (0.25 to 2 CU, Postgres
  18) and a PlanetScale Postgres database on a PS-5 single node (Postgres
  18.7), both in AWS London, `eu-west-2`. Each holds only Better Auth's four
  tables and made-up accounts under `example.com`.
- **Versions**, every one exact in the catalog: better-auth 1.7.27,
  `@better-auth/drizzle-adapter` 1.7.27, drizzle-orm 0.45.4, drizzle-kit
  0.31.11, pg 8.23.1, wrangler 4.162.0, compatibility date 2026-11-15. The
  Worker's bundle is 2,302 KiB (413 KiB gzipped) by
  `wrangler deploy --dry-run`; the limit is 64 MiB uncompressed on both plans
  ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
- **From where.** `src/measure.ts` ran on the owner's machine (macOS, in the
  UK), one request at a time. The Worker ran on Cloudflare's network; which of
  its locations answered was not recorded.
- **CPU time** is what Cloudflare reports for each request, `$workers.cpuTimeMs`
  in the Query Builder of the Worker's Observability page, not a timer in the
  code.
- **The runs**, all on Workers Free:

  | Step   | Run        | From (UTC)         | To (UTC)           |
  | ------ | ---------- | ------------------ | ------------------ |
  | `cpu`  | `mwuuaaxg` | 24 Nov 2026 15:18  | 24 Nov 2026 15:28  |
  | `warm` | `mwuuxxpk` | 24 Nov 2026 15:36  | 24 Nov 2026 15:38  |
  | `hung` | `mwuv1ixd` | 24 Nov 2026, after `warm` | before `cold` |
  | `cold` | `mwuvs802` | 24 Nov 2026 16:00  | 25 Nov 2026 00:46  |

## 1. CPU time

**It doesn't fit.** The limit on Workers Free is 10 ms of CPU per request
([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).

20 requests of each kind per host, one a second, a minute between batches, on
24 Nov 2026 from 15:18 to 15:28 UTC. The CPU columns are the Query Builder's
table, median and max of `$workers.cpuTimeMs` grouped by `$workers.outcome`,
read on 25 Nov 2026: its time range takes whole minutes, and with a minute
between batches a range of one or two minutes holds exactly one batch. They
are over the requests Cloudflare let finish. The time columns are the
script's, from the owner's machine, over the requests that got their expected
answer; a 401 is the expected answer to a wrong password.

| Host        | Request                 | Finished | Cut | CPU median | CPU worst | Median time | Worst time |
| ----------- | ----------------------- | -------- | --- | ---------- | --------- | ----------- | ---------- |
| Neon        | sign-up                 | 20       | 0   | 103 ms     | 131 ms    | 282 ms      | 970 ms     |
| Neon        | sign-in, right password | 20       | 0   | 88 ms      | 116 ms    | 211 ms      | 356 ms     |
| Neon        | sign-in, wrong password | 20       | 0   | 97 ms      | 167 ms    | 263 ms      | 502 ms     |
| Neon        | session read            | 20       | 0   | 8 ms       | 45 ms     | 94 ms       | 328 ms     |
| PlanetScale | sign-up                 | 13       | 7   | 158 ms     | 218 ms    | 351 ms      | 687 ms     |
| PlanetScale | sign-in, right password | 13       | 7   | 146 ms     | 271 ms    | 303 ms      | 769 ms     |
| PlanetScale | sign-in, wrong password | 2        | 18  | 85 ms      | 103 ms    | 265 ms      | 339 ms     |
| PlanetScale | session read            | 20       | 0   | 8 ms       | 75 ms     | 101 ms      | 494 ms     |

- **Requests cut: 32 of 160**, all among the 120 that hash a password.
  Cloudflare's outcome for each is `exceededCpu`, and the script got a 503
  with Cloudflare's own error page. Over the whole step the table gave 128
  requests with the outcome `ok`, median 90 ms and worst 271 ms, and 32 with
  `exceededCpu`, which report a median of 10 ms, the limit, and up to 94 ms.
- **Why the first ones were let through.** The limits page says: "Each isolate
  has some built-in flexibility to allow for cases where your Worker
  infrequently runs over the configured limit. If your Worker starts hitting
  the limit consistently, its execution will be terminated according to the
  limit configured." All 60 of Neon's requests that hashed a password
  finished. In each of PlanetScale's three batches the charts show the
  finished requests first and the cut ones after them: 13 then 7, 13 then 7,
  and 2 then 18.
- **This says nothing about PlanetScale.** Its batches ran after Neon's, so
  the host and the moment are mixed: CPU time is the Worker's, and the
  database only makes the Worker wait, which does not count as CPU (same
  page). A run in the opposite order was not made.
- **A single hash passed every time.** The other steps each signed up one
  user per host, a minute or more apart, and none of those sign-ups was cut.
- The script sent 161 requests in the step, counting the one that checks the
  token, and the table counted 160. The next day's run was one short too;
  why is not known.

## 2. Does Neon sleep?

**Yes.** Neon only, read in the project's console.

- On 25 Nov 2026 at 09:12 UTC, more than 8 hours after the last request, the
  endpoint was inactive. The compute chart on the same page showed it
  suspended between the rounds of the `cold` step, which wakes it every 35
  minutes.
- On 25 Nov 2026 at 10:29 UTC, 52 minutes after the last request of
  [the passwordless run](passwordless-login.md), the chart showed it inactive
  again from a few minutes after that run.
- **Compute hours.** From the project's creation on 24 Nov 2026 at 14:38 UTC
  to 25 Nov 2026 at 09:12 UTC the console counted 0.51 CU-hours and 32 MB of
  storage: the migration, about 660 requests in an hour of the afternoon, and
  15 wake-ups overnight. At 10:29 UTC, after the 208 requests of the
  passwordless run, it still said 0.51; whether that figure lags is not
  known. The free plan gives 100 CU-hours a month per project
  ([Neon's plans](https://neon.com/docs/introduction/plans)).
- A wake-up keeps the compute on for at least the 5 minutes before it sleeps
  again, which at the smallest size, 0.25 CU, is about 0.02 CU-hours: an
  estimate from the plan's numbers, not a reading.

## 3. The first request

The first session read after 35 idle minutes, 5 rounds per host, on 24 Nov
2026 between 16:35 and 18:55 UTC. Each round first sent one request without
the token, which the Worker answers 401 before touching a database, so the
Worker's own cold start is not charged to a host; then one session read per
host, in alternating order.

| Request                              | n | Median | Worst   |
| ------------------------------------ | - | ------ | ------- |
| No token, 401, no database           | 5 | 338 ms | 372 ms  |
| Neon, session read                   | 5 | 920 ms | 1368 ms |
| PlanetScale, session read            | 5 | 254 ms | 419 ms  |

By position in the round: Neon read first 920 ms median and 1146 ms worst
(n=3), read second 1076 ms and 1368 ms (n=2); PlanetScale read first 371 ms
and 419 ms (n=2), read second 208 ms and 254 ms (n=3).

Against the warm read of section 5, the first request cost about 840 ms more
on Neon and about 170 ms more on PlanetScale. PlanetScale's node never sleeps,
so its extra time is not a database waking; this spike doesn't show what it
is.

## 4. Waking Neon early

**It works.** Neon only: after 35 idle minutes the script sent `/wake`, which
runs `select 1`, without waiting for its answer, and sent the session read 2
or 10 seconds after `/wake` was sent, as an app would fire the wake on opening
and the user act a moment later. 5 rounds per gap, on 24 Nov 2026 from 19:30
UTC to 25 Nov 2026 at 00:46 UTC.

| Gap  | Request          | n | Median  | Worst   |
| ---- | ---------------- | - | ------- | ------- |
| 2 s  | session read     | 5 | 189 ms  | 215 ms  |
| 2 s  | the `/wake` itself | 5 | 1103 ms | 1226 ms |
| 10 s | session read     | 5 | 298 ms  | 379 ms  |
| 10 s | the `/wake` itself | 5 | 978 ms  | 2941 ms |

- Against 920 ms with no wake, the read took 189 ms at 2 seconds and 298 ms
  at 10.
- The `/wake` took about a second, which is the wake-up the user no longer
  waits for. In one round of 10 it took 2.9 seconds, so a user who acts within
  the first second or two still waits for the rest of it.
- The read was slower 10 seconds after the wake than 2 seconds after it, in
  every round. This spike doesn't explain it, and both are above the warm
  82 ms.

## 5. A warm request

50 session reads per host after one `/wake`, on 24 Nov 2026 between 15:36 and
15:38 UTC, all answered 200.

| Host        | n  | Median | Worst  |
| ----------- | -- | ------ | ------ |
| Neon        | 50 | 82 ms  | 175 ms |
| PlanetScale | 50 | 84 ms  | 172 ms |

PlanetScale's query insights showed the session query itself at a median of
0 ms over 575 runs, so nearly all of those 80 ms are the network, the Worker
and Hyperdrive, not the database.

## 6. Hung requests

**None.** 500 session reads in a row per host, one a second, on 24 Nov 2026:
all 1,000 answered 200.

| Host        | n   | Not 200 | Median | Worst  |
| ----------- | --- | ------- | ------ | ------ |
| Neon        | 500 | 0       | 79 ms  | 302 ms |
| PlanetScale | 500 | 0       | 86 ms  | 630 ms |

## If sign-in doesn't fit in 10 ms

It doesn't, so these are the ways out. The owner decides.

- **The Workers Paid plan.** A minimum of 5 USD a month for the account, with
  10 million requests and 30 million CPU milliseconds included, then 0.02 USD
  per extra million CPU milliseconds; the CPU limit becomes 30 seconds a
  request by default
  ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
  read on 25 Nov 2026). At the 90 to 160 ms measured here, the included CPU
  time covers about 190,000 to 330,000 sign-ins a month, an estimate. Not
  tried.
- **Login without a password**, by a code sent by email and by passkey.
  Measured on the same Worker on 25 Nov 2026 for
  [#58](https://github.com/julian-palomo/paste-and-taste/issues/58): no
  request was cut, at a median of 10 ms of CPU. Its figures are in
  [`passwordless-login.md`](passwordless-login.md).
- **Another hash.** Better Auth hashes with scrypt and takes replacements as
  `emailAndPassword.password.hash` and `verify`
  ([its email and password page](https://better-auth.com/docs/authentication/email-password),
  read on 25 Nov 2026). A password hash is slow on purpose, so one that fits
  in 10 ms gives up what it is for. Free, not recommended, not tried.
- **Neon's managed Better Auth.** A service Neon runs, built on Better Auth
  1.7.12, that the app calls over HTTP: "The Auth service validates
  credentials against `neon_auth.account`, creates a session in
  `neon_auth.session`, and returns the session cookie", so the Worker hashes
  nothing. The users live in the app's own database, in a `neon_auth` schema
  that SQL can read. No separate charge, up to 60,000 monthly users a project
  on the Free plan
  ([about](https://neon.com/docs/auth/about),
  [the flow](https://neon.com/docs/auth/authentication-flow), read on 25 Nov
  2026). Those pages name email and password and social providers, and
  mention neither passkeys nor signing in with a code; Workers and React
  Native aren't mentioned, and nor is a way to leave it for a Better Auth of
  the app's own. It ties login to this host. Not tried.
- **Google alone.** No password is hashed in the Worker. Free. It was out of
  this spike's scope, so its CPU time is not measured, and
  [App Store guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)
  asks an app whose account uses a third-party login to offer another login
  service too.
- **Counting on the flexibility** that let single sign-ups through. Free, and
  not an option: the limits page says a Worker that hits the limit
  consistently is terminated, and 32 requests were.

## The two hosts side by side

Plans and prices as their pages gave them on 23 and 24 Nov 2026.

|                                   | Neon, Free plan                          | PlanetScale, PS-5 single node          |
| --------------------------------- | ---------------------------------------- | -------------------------------------- |
| Warm session read, median         | 82 ms                                    | 84 ms                                  |
| First read after 35 idle minutes  | 920 ms; 189 ms with a wake 2 s before    | 254 ms                                 |
| 500 reads in a row                | all 200                                  | all 200                                |
| Price                             | 0 USD                                    | 5 USD a month, used or not             |
| What it gives                     | 0.25 to 2 CU, 1 GB, 100 CU-hours a month | 1/16 vCPU, 512 MiB, 10 GB              |
| Sleeps                            | after 5 idle minutes; can't be turned off | never                                 |
| When the allowance runs out       | the compute is suspended until the next month or an upgrade | no allowance to run out |
| Backups                           | a 6-hour history window and 1 manual snapshot | every 12 hours, kept 2 days, and point-in-time restore |
| Seen idle in its dashboard        | compute suspended                        | CPU 21 to 22 %, memory 100 %           |

Sources: [Neon's plans](https://neon.com/docs/introduction/plans) and
[pricing](https://neon.com/pricing);
[PlanetScale's pricing](https://planetscale.com/pricing) and
[Postgres pricing](https://planetscale.com/docs/postgres/pricing). The last row
is each dashboard on 25 Nov 2026, with nothing calling either database.

## How it grows

A proposal for the owner, from the prices above; none of it was tried.

1. **While the users are the owner's friends:** Neon's Free plan, with the app
   sending the wake request when it opens.
2. **Time to pay when** any of these shows: users notice the first request in
   spite of the wake; the project nears 100 CU-hours or 1 GB in a month; or the
   recipes would hurt to lose, since a 6-hour history is all the free plan
   keeps.
3. **Paying, two ways:**
   - Neon's Launch plan bills use alone, 0.106 USD a CU-hour and 0.35 USD a
     GB-month, keeps up to 7 days of history, and lets the sleep be turned
     off. Always on at the smallest size that is about 19 USD a month of
     compute (0.25 CU × 730 hours, an estimate); asleep most of the day it is
     a few dollars.
   - PlanetScale's PS-5 is 5 USD a month always on. Its next single nodes in
     London are PS-10 at 16 USD and PS-20 at 23 USD, and three nodes with
     failover cost three times one.
4. **More load after that:** Neon grows on its own up to 16 CU on Launch;
   PlanetScale grows by choosing a bigger node.
5. **Changing host** stays possible because both are plain Postgres: a
   `pg_dump` and `pg_restore`, and the Hyperdrive configuration pointed at the
   new database. It stays simple if the app uses no extension only one host
   has and both run the same Postgres version; both ran 18 here. Neon's
   managed Better Auth, above, would be the one thing that doesn't move.

## Hyperdrive: the id and the deploy token

- **Can a Hyperdrive id be committed to a public repo?** Cloudflare doesn't
  say. [The get-started guide](https://developers.cloudflare.com/hyperdrive/get-started/)
  puts the id in the Wrangler file, and neither it,
  [the Wrangler configuration page](https://developers.cloudflare.com/workers/wrangler/configuration/)
  nor [the Hyperdrive commands](https://developers.cloudflare.com/workers/wrangler/commands/hyperdrive/)
  says whether it is sensitive (read on 25 Nov 2026). The guide does say the
  connection string Hyperdrive hands out is "only accessible from your
  Worker". The spike kept both ids out of the repo, in a copy of the Wrangler
  file that git ignores. Where the API's id lives is for the issue that gives
  the API its binding.
- **The deploy token.**
  [The permissions list](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
  has two account permissions, "Hyperdrive Read" and "Hyperdrive Edit". No
  page read says which of them, if any, a `wrangler deploy` of a Worker with
  a Hyperdrive binding needs. **Only read, not tried:** the owner deployed the
  spike from a `wrangler login` session, not with the pipeline's token.

## What the owner created and deleted

All by the owner, from the owner's own terminal and the providers'
dashboards. Everything was deleted the morning after the overnight run, once
the last figures were read:

| What                                                               | Created     | Deleted     |
| ------------------------------------------------------------------ | ----------- | ----------- |
| Neon project `paste-and-taste-login-spike`, London                 | 24 Nov 2026 | 25 Nov 2026 |
| PlanetScale database `paste-and-taste-login-spike`, London         | 24 Nov 2026 | 25 Nov 2026 |
| Hyperdrive configuration `paste-and-taste-login-spike-neon`        | 24 Nov 2026 | 25 Nov 2026 |
| Hyperdrive configuration `paste-and-taste-login-spike-planetscale` | 24 Nov 2026 | 25 Nov 2026 |
| Worker `paste-and-taste-login-spike` and its two secrets           | 24 Nov 2026 | 25 Nov 2026 |

**Spent:** 0.14 USD, the invoice PlanetScale showed the owner once the
database was deleted, paid on 25 Nov 2026. Neon and Cloudflare cost nothing.
PlanetScale's billing page had shown 0.23 USD for the month so far that
morning at 09:21 UTC; why the invoice is lower was not looked into. The
issue's budget was 2 USD.

## What the run taught

- **PlanetScale's creation screen starts on three nodes**, 15 USD a month. The
  owner created that and changed it to a single node; the first hours were
  billed as three.
- **`wrangler hyperdrive create` offers to add the binding to the Wrangler
  file.** Answering yes edits the committed file with the new id. The answer
  is no; the owner restored the file.
- **PlanetScale's connection string carries `sslrootcert=system`**, which `pg`
  reads as a file name, so `drizzle-kit migrate` failed until the parameter was
  removed. The prototype's README has the line that removes it.
- **The Query Builder's time range takes whole minutes, not seconds**, and it
  offered no key for the request's path, so `$workers.event.request.path`, the
  plan's way to split the batches, returned nothing. What works is a minute
  or more between batches, one range per batch, and grouping by
  `$workers.outcome`, which also separates the cut requests.

## What was not tried

- The Workers Paid plan, and any hash other than Better Auth's own.
- Google sign-in, sending email, and the web and native apps: the wake
  request was sent by the script, not by an app.
- The `cpu` step with PlanetScale before Neon, and each host from a location
  other than the owner's.
- Hyperdrive with its cache on, and more than one request at a time.
- Deploying with the pipeline's token, and moving a database from one host to
  the other.
- Neon's paid plan and its managed Better Auth, and PlanetScale's bigger
  nodes or three nodes.
