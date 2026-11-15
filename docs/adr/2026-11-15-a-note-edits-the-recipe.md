# No notes field: a note edits the recipe

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

A user can always edit a saved recipe, whether they imported it, copied it or
wrote it. A cook's remark on a recipe usually changes it.

## Decision

A recipe has no separate notes field. The user writes a note and a model
rewrites the recipe with it. The change is shown before it is saved, and the
previous version is kept so it can be undone.

## Alternatives considered

- **A free-text notes field next to the recipe.** Simpler to build. The
  recipe and its notes drift apart, and cooking means reading both.

## Consequences

- A recipe has versions.
- Each note costs a model call.
- Both the web app and the native app need a view that shows what changed.
