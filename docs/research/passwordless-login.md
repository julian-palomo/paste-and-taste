# Login without a password on a Worker on the free plan

A spike's report: whether signing in with a code sent by email, and with a
passkey for the next times, fits the CPU limit of the Workers Free plan,
measured on the Worker of [the login report](login-on-workers.md) while it was
still deployed. The code is throwaway, in
[`prototypes/login`](../../prototypes/login/README.md); this report stays.

The app's login is **not decided** by this report:
[`product.md`](../product.md) still says password and Google. If the owner
decides for a login without a password, that is a new record in
[`docs/adr/`](../adr/README.md) and its own issue.

Every figure is a measurement unless it says it is a reading by eye.

## The short answer

- **No request was cut.** Cloudflare counted 207 requests in the run's seven
  minutes, every one with the outcome `ok`. The day before, on the same
  Worker, it cut 32 of the 120 requests that hashed a password.
- **About a tenth of the CPU of a password**: a median of 10 ms and a worst of
  98 ms over those 207 requests, against a median of 88 to 158 ms for a
  request that hashes a password.
- **At the limit, not under it.** The limit is 10 ms. By eye, signing in with
  a code and verifying a passkey sit a little above it, at about 11 to 15 ms.
  Whether Cloudflare would cut them under steady traffic was not tried.
- **The Worker checks for real**: a wrong code and a signature from another
  key were both refused.

## How it was measured

- **The same Worker as the login report**, `paste-and-taste-login-spike` on
  Workers Free, deployed again by the owner on 25 Nov 2026 with two Better
  Auth plugins added: `emailOTP`, from `better-auth/plugins/email-otp`, and
  `passkey`, from `@better-auth/passkey`. Password sign-in stayed in it. A new
  `pg` client and Better Auth instance per request, as before.
- **Neon only**, through its Hyperdrive configuration with the cache disabled.
  CPU time is the Worker's, and waiting for the database doesn't count as CPU
  ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)),
  so one host is enough.
- **Versions**, exact in the catalog: better-auth 1.7.27,
  `@better-auth/passkey` 1.7.27, `@better-auth/drizzle-adapter` 1.7.27,
  drizzle-orm 0.45.4, pg 8.23.1, wrangler 4.162.0, compatibility date
  2026-11-15. With the two plugins the Worker's bundle is 3,070 KiB (552 KiB
  gzipped) by `wrangler deploy --dry-run`, up from 2,302 KiB.
- **No email was sent.** The plugin's send function does nothing; the script
  read each code through a route that only exists in this spike, behind the
  run's token, and that answers only for the script's own addresses under
  `example.com`.
- **The script played the device.** It held a P-256 key per user and answered
  the registration and the sign-in as a phone would, so the Worker verified a
  real signature. No phone or browser took part.
- **The run**, `mwvxagy8`: 25 Nov 2026, 09:30:12 to 09:36:45 UTC, from the
  owner's machine (macOS, in the UK), one request a second, 20 seconds between
  batches. 20 made-up users asked for a code and signed in with it, which
  created their accounts; the same 20 did it again as existing users; each
  then registered a passkey and signed in with it, starting with no session.
- **CPU time** is what Cloudflare reports, `$workers.cpuTimeMs` in the Query
  Builder of the Worker's Observability page.

## The figures

**Over the whole run, exact.** The Query Builder's table for 25 Nov 2026,
09:30 to 09:37 UTC, grouped by `$workers.outcome`: one row, `ok`, 207
requests, median 10 ms of CPU, worst 98 ms. No request had any other outcome,
so **0 were cut**.

The script sent 208 requests: one to check the token, 200 in the ten batches
below and 7 in the checks. Why Cloudflare counted one fewer is not known.

**By kind of request.** The answers and times are the script's, from the
owner's machine. The CPU columns were **read by eye** from the Query Builder's
two charts, median and max of `$workers.cpuTimeMs`, which draw a point every
few seconds: its time range takes minutes, not seconds, and it offered no key
for the request's path, so a batch could not be read on its own. They are
approximate.

| Request                               | n  | Answers  | Median time | Worst time | CPU, median chart | CPU, highest point |
| ------------------------------------- | -- | -------- | ----------- | ---------- | ----------------- | ------------------ |
| Ask for a code, new user              | 20 | 200 × 20 | 85 ms       | 321 ms     | about 4 to 7 ms   | about 30 ms        |
| Sign in with the code, new user       | 20 | 200 × 20 | 140 ms      | 501 ms     | about 11 to 15 ms | 98 ms              |
| Ask for a code, existing user         | 20 | 200 × 20 | 102 ms      | 519 ms     | about 10 ms       | about 83 ms        |
| Sign in with the code, existing user  | 20 | 200 × 20 | 116 ms      | 233 ms     | about 9 to 12 ms  | about 37 ms        |
| Passkey registration: the options     | 20 | 200 × 20 | 93 ms       | 199 ms     | about 9 to 13 ms  | about 21 ms        |
| Passkey registration: the verifying   | 20 | 200 × 20 | 108 ms      | 208 ms     | about 10 to 13 ms | about 18 ms        |
| Passkey sign-in: the options          | 20 | 200 × 20 | 102 ms      | 188 ms     | about 7 to 10 ms  | about 13 ms        |
| Passkey sign-in: the verifying        | 20 | 200 × 20 | 125 ms      | 383 ms     | about 11 to 15 ms | about 48 ms        |

- The 98 ms is the run's exact worst. By its place in the chart it is the
  first request or two of "Sign in with the code, new user", the request that
  creates the account.
- In every batch the highest point is the first one, after the 20 idle
  seconds; the rest of each batch is close to its median.
- The two batches that read the codes through the spike's route are not in
  the table: that route doesn't exist in a real login. By eye they took about
  6 to 8 ms.
- Reading a session, measured the day before, took a median of 8 ms. So most of
  these requests' CPU is what every request with a session pays, the Better
  Auth instance and the `pg` client it sets up, and the code or the passkey
  adds a few milliseconds to it.

**The checks**, each sent once at the end of the run:

| Check                                             | Answer |
| ------------------------------------------------- | ------ |
| The session a passkey sign-in gave reads back     | 200    |
| Signing in with a wrong code                      | 400    |
| A passkey sign-in signed with another key         | 401    |
| Asking the spike's route for an address not its own | 404  |

## What it means for the free plan

The limits page gives a Worker "some built-in flexibility to allow for cases
where your Worker infrequently runs over the configured limit", and says that
one that "starts hitting the limit consistently" is terminated. Nothing was
cut in 207 requests at one a second. But the run's median is the limit
itself, so about half of them were at or over it, and a plain session read is
already at a median of 8 ms. So on Workers Free every
request with a session runs next to the limit, with or without a password,
and this run doesn't show what Cloudflare does when such requests come
steadily. The Workers Paid plan, 5 USD a month, moves the limit to 30 seconds
([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).

## What each would still need to be the app's login

**The code by email**

- A service that sends the email, and its cost. None was chosen or called.
- Better Auth's limiter on, which the spike turned off to measure; and the
  code's defaults confirmed: 6 digits, 300 seconds, 3 attempts
  ([the plugin's page](https://better-auth.com/docs/plugins/email-otp)).
- The choice of keeping a user signed in. In better-auth 1.7.27 the
  `rememberMe` option exists for password sign-in only, read in its code on
  24 Nov 2026, so it would have to be built for sign-in with a code.
- A way back in for a user who loses the email address.

**The passkey**

- A real device: a phone and a browser, and the native app. What a user sees,
  and whether passkeys work in the native app, were not tried.
- The app's final address. A passkey belongs to the site it was registered
  on, and the name and the domain are not decided.
- The code by email stays as the way in on a new device: registering a
  passkey needs a session
  ([the plugin's page](https://better-auth.com/docs/plugins/passkey)).

**Both**

- The Workers plan, from the section above.
- The owner's decision, its record, and `product.md` saying so.

## What was not tried

- Steady or parallel traffic: every request ran alone, one a second.
- A real email, a real passkey on a device, a browser and the native app.
- PlanetScale, Google sign-in, recovering an account and how long a session
  lasts.
- The Workers Paid plan.
