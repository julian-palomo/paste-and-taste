# Staying signed in: an unchecked box, and no cookie banner

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The owner wants the app to follow the rules on cookies and privacy without
showing users a consent banner. On 24 Nov 2026 he chose to follow the rules of
the **UK and of Spain**, the stricter of each where they differ.

A cookie that only keeps a user signed in for their visit needs no consent in
either: the ICO speaks of "the duration of their visit", and the AEPD of
cookies that last only the session. A cookie that keeps them signed in for
weeks is another matter: the Article 29 Working Party's Opinion 04/2012 says a
persistent login cookie is not exempt, and that a "remember me" box the user
ticks is valid consent. Read on 24 Nov 2026; this record is not legal advice.

## Decision

A session lasts while the app is open. Signing in shows a **"Mantener la
sesión iniciada"** box, **unchecked**; a user who ticks it stays signed in.
One who doesn't is asked again for their passkey or a code by email next time.

The owner chose it on 24 Nov 2026: he would rather have a long session, but
the box is the lesser evil, and it leaves the choice to the user.

## Alternatives considered

- **A long session for everyone, without asking.** The simplest for users, but
  with Spain's rules in, the readings above don't cover it.
- **A consent banner.** What the owner wants to avoid.
- **A box ticked by default.** Not consent: the user has to tick it.

## Consequences

- With the code by email ([the record](2026-11-25-login-without-a-password.md)),
  the box has to be built: in better-auth 1.7.27 `rememberMe` exists for
  password sign-in only.
- How long the session lasts with the box ticked is not decided.
- A privacy page before launch, reviewed by someone qualified, may say a
  longer session without the box is fine; then this record is replaced.
