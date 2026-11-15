# Better Auth for login

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

Users log in from the web app and from the native app, and the two keep a
session in different ways. The app is social: follows, comments and shared
recipes all point at a user.

The July plan listed Clerk, Auth0 or Supabase Auth.

## Decision

Login uses **Better Auth**, with the users in the project's own database.

## Alternatives considered

- **Clerk.** Less work, because it is hosted. The users would live outside
  the database that everything else joins against, and it is paid past a
  number of monthly users.
- **Sessions written by hand.** Ruled out: session handling is easy to get
  wrong, and nothing here needs a custom one.

## Consequences

- User data and its safety are the project's own responsibility.
- Better Auth has an Expo integration and an example on Workers with Hono (as
  read on 14 November 2026). There is none with NestJS, so it goes on the list
  of pieces to try on Workers first.
- Login needs the database in place before it.
