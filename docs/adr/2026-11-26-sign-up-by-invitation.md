# Sign-up by invitation until launch, and a daily ceiling on codes

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

Anyone who found the API's address could ask for a sign-in code for any
address, and signing in with it made an account. Each request also made the
app send an email. The login is about to be deployed on preview, whose
address is public (#94).

Resend's free plan sends 100 emails a day and 3,000 a month, and Resend may
pause an account whose bounce rate passes 4%
([the record](2026-11-25-resend-for-the-sign-in-code.md)). A stranger asking
for codes to addresses that don't exist would spend both.
[An import limit kept per user](2026-11-14-import-limit-per-user.md) says a
limit per user doesn't cap the total spend.

The owner decided on 25 Nov 2026:
- sign-up is by invitation until launch;
- the codes sent in a day have a ceiling for the whole app;
- the imports made in a day will have one too.

## Decision

The owner's choices, 26 Nov 2026:

- **Who gets a code: `SIGN_UP`, one value per environment.**
  - With `invited`, `POST /login/code` sends a code only to an address that
    has an account or is on the invited list, the table `invited_address`.
  - With `open`, it sends one to anyone, as before.
  - The values: `invited` in preview and production, `open` in local
    development, where the login runs only on the owner's machine.
  - **A missing value means `invited`,** so it fails closed.
  - **Launch** is a pull request that sets production to `open`, with its
    record.
- **A stranger learns nothing.** An address that may not get a code gets the
  same `200 { "sent": true }` as one that does, and nothing is made or sent.
  Signing in with it answers the same 401 as a wrong code, without reaching
  Better Auth, so no account comes out of it. This holds even if the address
  was taken off the list while its code was still valid.
- **Timing is accepted.** An address that gets a code waits for the send; one
  that doesn't answers sooner, so timing can tell them apart. That exists only
  while sign-up is by invitation, before launch. The per-IP and per-address
  limits slow anyone measuring it, and it reveals only that an address was
  invited or has an account.
- **The invited list holds the address only,** in lower case. Its row is
  deleted once that address signs in, so the address isn't kept twice. The
  owner adds and removes one with `pnpm -C apps/api invite add|remove`, which
  asks for the address on the terminal and never prints it
  (`docs/deploying-the-api.md`).
- **The ceiling: 40 codes a day for the whole app,** counted in Postgres like
  the other limits (`LIMITS.codesPerDay`).
  - **The window** starts at its first code, so two back-to-back windows send
    at most 80 in any 24 hours, under Resend's 100 whatever Resend's own
    window. In a month that is at most 1,200, under its 3,000.
  - **Past it,** every address gets the existing `429`, and one line is logged
    per window, with no address.
  - **An address that gets no code** isn't counted. Once the ceiling is full,
    it gets the same 429, so the ceiling tells a stranger nothing either.
  - **A failed send spends its slot.** The count is taken before the send,
    since counting after it would let two requests at once both pass the last
    slot. This is the one exception to "only codes really sent count".
  - **Limit rows live longer.** The ceiling sits in `LIMITS`, and the daily
    deletion takes its cutoff from the longest window there
    ([the record](2026-11-25-how-long-login-rows-live.md)). So a limit row
    holding an address or an IP now lives up to 48 hours instead of 25.
- **The imports get a daily ceiling for the whole app too,** besides each
  user's limit. The first import issue builds it.

## Alternatives considered

- **Open sign-up until launch:** anyone could make an account and make the
  app send email, from a public address.
- **An invite code typed at sign-up:** a code shared by hand leaks, and the
  sign-in page would need a second field.
- **The friend's invitation link now:** it belongs to the social part,
  phase 7. This list is what it will write to.
- **A background send for every address,** so that timing tells nothing: a
  failed send could no longer answer 502.
- **The ceiling outside `LIMITS`,** with the deletion skipping its key: it
  keeps the 25-hour bound, at the cost of special-casing one key.
- **A 503 past the ceiling:** new for this route, where the web app already
  shows a 429.

## Consequences

- Until launch, a new user needs the owner to run the invite command for each
  database.
- The web's message for a 429 on a code says to wait a few minutes, which is
  short for a daily ceiling. The web issue that says sign-up is by invitation
  can word it.
- Launch changes `SIGN_UP` in production, and this record gets a successor.
