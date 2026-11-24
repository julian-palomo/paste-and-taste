# A recipe shared by link can be read without an account

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

A user can share a recipe by link, for instance with someone who doesn't use
the app ([the friends and groups record](2026-11-24-friends-groups-and-copies.md)).
Whoever opens that link may have no account. The owner wants new people to
reach the app through what their friends share, and wants signing up to be
fast.

## Decision

Anyone with the link reads the whole recipe, without an account. The link
can't be guessed, search engines don't index it, and whoever shared it can
stop sharing it. Keeping the recipe or cooking it in the app leads to
signing up.

The owner chose it on 24 November 2026, from four options.

## Alternatives considered

- **A preview only**: the title and a picture, and the rest after signing up.
  It pushes people to sign up, and it annoys the friend who only wanted to
  read a recipe they were sent.
- **An account required** to open the link. The most closed, and the one
  that loses most people at the door.
- **A link that expires** after some days. Safer if a link travels too far,
  and it breaks a link someone saved to cook from later.

## Consequences

- The web app has a page that shows a recipe to a visitor who isn't logged
  in, rendered on the server.
- A shared recipe is reachable by whoever gets the link, so stopping sharing
  must really stop it: the link is checked on every visit, not copied.
- Most recipes are other people's content. The page shows where the recipe
  came from, and the link is not indexed.
