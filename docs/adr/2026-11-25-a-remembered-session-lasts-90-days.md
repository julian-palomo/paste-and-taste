# A remembered session lasts 90 days from its last use

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

A session lasts while the app is open, and a "Mantener la sesión iniciada" box,
unchecked, lets a user stay signed in
([the record](2026-11-24-staying-signed-in.md)). That record left open how
long a session lasts with the box ticked.

Better Auth keeps a session for 7 days by default, and renews it when it is
used more than a day after its last renewal. In better-auth 1.7.27 only the
password sign-in has a "remember me" option; the code by email and the passkey
([the record](2026-11-25-login-without-a-password.md)) have none, so the box
has to be built for them.

## Decision

With the box ticked, a session lasts **90 days from its last use**: each use
more than a day after the last renewal moves its end 90 days on. A user who
opens the app at least once in 90 days stays signed in.

Without the box, the session cookie has no expiry, so it ends when the browser
or the app closes. The session itself expires a day after sign-in and is never
renewed, as Better Auth's own "don't remember me" does, so a browser that is
never closed doesn't keep it.

The owner chose the 90 days on 25 Nov 2026; the day without the box is the
plan's, which the owner approved on issue
[#69](https://github.com/julian-palomo/paste-and-taste/issues/69).

## Alternatives considered

- **Better Auth's 7 days.** A user who opens the app once a week or less would
  sign in again nearly every time.
- **A fixed end, counted from sign-in.** Simpler, but a user who uses the app
  every day would still be asked to sign in every 90 days.
- **No server-side end without the box.** The cookie alone would end the
  session, and a browser left open would keep it for as long as Better Auth's
  default allows.

## Consequences

- The box is built in the API: the sign-in routes take `rememberMe`, and a
  hook does Better Auth's "don't remember me" after the code and the passkey
  sign-ins (`apps/api/src/login/remember-me.ts`).
- A session read renews a remembered session at most once a day, which writes
  to the database then.
- Reading `docs/adr/2026-11-24-staying-signed-in.md` with this one gives the
  whole rule; that record stays as it was.
