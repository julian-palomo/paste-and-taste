# A recipe's ingredients and steps as jsonb in its own row

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The first table holds each user's recipes
([#73](https://github.com/julian-palomo/paste-and-taste/issues/73)). A recipe
has a title, a language, servings and a time as its source states them, a link
to its source, and two ordered lists: its ingredients, each a name with a
quantity and a unit that may be missing, and its steps. That is the shape the
import prototype produced (`prototypes/instagram/src/recipe-schema.ts`), and
the import will create recipes in it.

The API reads a recipe whole and replaces it whole: `PUT /recipes/{id}`
replaces it, and the notes and variants to come rewrite the recipe too
([the record](2026-11-15-a-note-edits-the-recipe.md)). Searching recipes is a
later issue.

## Decision

A recipe is **one row** of the `recipe` table, with its ingredients and its
steps as **`jsonb` arrays** in that row. The array keeps their order, and an
edit is one `UPDATE`.

The owner approved it on 25 Nov 2026, in the plan on issue
[#73](https://github.com/julian-palomo/paste-and-taste/issues/73).

## Alternatives considered

- **An `ingredient` and a `step` table**, each row with its recipe and its
  position. Each ingredient is a column a query can reach, but every read
  joins three tables and every edit rewrites rows in a transaction, for lists
  that are never read apart from their recipe.
- **Text columns**, the ingredients and steps as written. They lose the
  structure the import produces, which the screen and the change of servings
  need.

## Consequences

- Finding recipes by an ingredient needs a `jsonb` index or a search column
  when search is built; Postgres has both.
- The API validates the arrays' shape on the way in; the database only checks
  they are present.
- Changing an ingredient's shape later means rewriting the stored arrays in a
  migration.
