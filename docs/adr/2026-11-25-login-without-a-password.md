# Login without a password: a code by email and an optional passkey

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Login is Better Auth, with the users in the app's own database
([the record](2026-11-15-better-auth.md)), and the API is a Worker on the
Workers Free plan, which allows 10 ms of CPU a request. `product.md` said a
user signs in with a password or with Google.

Two spikes measured it on one deployed Worker on 24 and 25 Nov 2026:

- **A password doesn't fit.** A request that hashes one took a median of 88
  to 158 ms of CPU, and Cloudflare cut 32 of the 120 such requests
  ([the report](../research/login-on-workers.md)).
- **Without a password it fits, at the limit.** Asking for a code, signing in
  with it, and registering and using a passkey: 207 requests, none cut, a
  median of 10 ms and a worst of 98 ms of CPU
  ([the report](../research/passwordless-login.md)).

## Decision

A user signs in with a **code sent to their email address**. Once signed in,
the app offers a **passkey** for the next times; it is optional, and on a new
device the code by email is the way in again. There is **no password and no
Google**. It stays Better Auth, with its `emailOTP` and `passkey` plugins.

The owner chose it on 25 Nov 2026, after the figures and after reading that
Neon's managed login doesn't mention passkeys or codes: he would rather have
no passwords. He had liked the idea the day before: an email code first, then
the phone offers a passkey, and not only passkeys, since some people don't get
on with them.

## Alternatives considered

- **A password and Google**, what `product.md` said. The hash doesn't fit
  Workers Free, so it needs Workers Paid; and a password is one more thing to
  forget and to reset.
- **Google alone.** Not measured. App Store guideline 4.8 asks an app whose
  account uses a third-party login to offer another one too, and it ties every
  account to Google.
- **A faster password hash.** A password hash is slow on purpose; one that fits
  in 10 ms gives up what it is for.
- **Neon's managed Better Auth**, which hashes outside the Worker. Its pages
  mention neither passkeys nor codes, nor a way to leave it, and it ties login
  to the database host. Not tried.

## Consequences

- **The app sends email, and the code must arrive.** It needs a service that
  sends it, with its cost; not chosen yet. The owner chose on 25 Nov 2026
  what goes with it: the email is sent from the app's own domain with SPF,
  DKIM and DMARC set up; codes are limited per address and per IP, so nobody
  can send them to others' addresses at will; an alert says when sending
  starts to fail or bounce; and a user whose code doesn't arrive has a form
  on the sign-in screen, not a published address
  ([`product.md`](../product.md)).
- **An email address is the account**: losing access to it means losing the
  way in, so recovering an account needs its own answer.
- **Passkeys belong to the app's address.** They are registered against the
  domain, which isn't decided, and whether they work in the native app wasn't
  tried.
- **Every request with a session sits next to the free plan's limit**, at a
  median of 8 to 10 ms, so the real login moves to Workers Paid
  ([the record](2026-11-25-workers-free-until-login-ships.md)).
- **Staying signed in has to be built** for the code: in better-auth 1.7.27 the
  `rememberMe` option exists for password sign-in only
  ([the record](2026-11-24-staying-signed-in.md)).
- **Better Auth's limiter** goes on, and the code's defaults (6 digits, 300
  seconds, 3 attempts) are checked when the login is built.
