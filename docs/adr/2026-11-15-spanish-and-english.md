# The interface in Spanish and English from day one

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

The first users speak Spanish or English. Recipes arrive in whatever language
their source uses.

## Decision

The interface is in Spanish and English from the first screen. A recipe stays
in the language it was imported in. Translating recipes with a model comes
later.

## Alternatives considered

- **One language first.** Adding a second one later means going back through
  every screen of two frontends.
- **Translating each recipe on import.** It adds a model call to every import
  and can change a recipe's meaning. Left for later.

## Consequences

- Every piece of text a user sees goes through translation files, in both
  frontends.
- Search has to cope with recipes in more than one language.
