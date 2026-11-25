# Tailwind CSS 4 from one tokens file, and motion without a library

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The web app had no styles: every later screen needs a way to write them, and
the app's look (palette, typeface, logo, name) is not decided yet, so it has
to be easy to change later without touching every component. Pages are
rendered on the server, so the stylesheet has to be in the HTML's `<head>`
before any JavaScript runs. The owner already uses Tailwind CSS in two other
projects, and his personal site makes its animations with no library.

## Decision

The owner decided, on 23 November 2026:

- **Tailwind CSS 4**, through its Vite plugin. Every colour, font, radius,
  duration and easing is declared in one file,
  `apps/web/src/styles/tokens.css`, with `@theme static`, under names that
  say their role (`surface`, `text-muted`, `accent`, `danger`), not their
  value. Tailwind's own palette, fonts, radii and easings are removed there,
  so a component can only write a token. The values are neutral placeholders.
- **Motion is made the way his personal site makes it**, unless something
  better turns up: CSS transitions and keyframes, the browser's Web
  Animations API, View Transitions between pages, and a small spring of its
  own. No animation library. For now only CSS transitions are used, for
  hover, focus and a press, from the tokens' durations and easings; with
  `prefers-reduced-motion: reduce` the duration tokens are zero.

## Alternatives considered

- **CSS Modules with no library.** No dependency, and scoped class names, but
  the tokens would be plain CSS variables with nothing stopping a raw value,
  and every component would need its own file. It lost to the tool the owner
  already knows.
- **Panda CSS.** Typed tokens and styles written in TypeScript, but a code
  generator and a new tool to learn, for a look that isn't decided yet.
- **An animation library** (such as Motion). It would add JavaScript to every
  page for what CSS and the browser's own APIs already do.

## Consequences

- The look changes in `tokens.css`. A new role is a new token there, never a
  raw value in a component.
- Tailwind reads a token only under its own namespaces: a duration must be
  `--transition-duration-*` for `duration-*` to exist. A token under another
  name produces no utility, and no error.
- Sharing the tokens with the native app is left for later. The file is plain
  CSS variables with role names, so they can be carried over.
- Page transitions, springs and gestures come with the screens that need them,
  made as above.
