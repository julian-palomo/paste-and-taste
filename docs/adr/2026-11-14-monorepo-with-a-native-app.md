# A monorepo with a native app, a web app and an API

- **Status:** Accepted
- **Date:** 2026-11-14

## Context

Saving a recipe from the phone has to be as easy as possible, above all from
Instagram and YouTube. The easiest gesture is the phone's share menu. On
iPhone only a native app appears in that menu: Safari doesn't support
`share_target` for installed web apps (checked on 14 November 2026). Chrome on
Android does.

The plan from July 2026 was a web app first, with a native app in a later
phase.

## Decision

One repository holds a React Native app, a web app and an API. The native app
is there from the first phase. The API holds the logic, and the web app and
the native app are clients of it.

Development happens on Android, the owner's phone. iPhone is tested early,
because its share menu is the riskiest piece.

## Alternatives considered

- **An installable web app only.** One frontend instead of two, and it reaches
  the share menu on Android. It can't reach it on iPhone, which leaves pasting
  a link as the only way in.
- **The native app in a later phase**, as in the July plan. It postpones the
  piece most likely to change the design.
- **Micro frontends.** Ruled out in the July plan and not reopened.

## Consequences

- Two frontends to build and keep in step. Types shared through the repo are
  what keeps them from drifting away from the API.
- An installed app doesn't update at once the way a web page does, so the API
  can't break older versions of the app.
- The share-menu libraries looked at so far are marked experimental, so a
  prototype comes before anything is built on them.
- Publishing on iPhone needs Apple's paid developer account.
