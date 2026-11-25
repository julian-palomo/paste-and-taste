# A deleted recipe is removed at once, and the delete answers 204

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

A user deletes one of their own recipes (#95). The recipes are rows of
`recipe`, each with its copy owner, and every recipes route already answers
the same 404 for an unknown recipe and another user's. The app keeps as
little about a person as it can (`docs/product.md`), and no conversation,
photo or version of a recipe exists yet.

The typed client turns a success with an empty body into
`ApiUnreachableError` ([the record](2026-11-23-api-unreachable-error.md)).
openapi-fetch 0.17.0 gives a 204 the same empty `data` as a 200 with
`Content-Length: 0` (`dist/index.mjs`, line 180).

## Decision

The owner's choices, 25 Nov 2026:

- **The row is removed at once.** `DELETE /recipes/{id}` deletes the row whose
  id and copy owner match, in one statement. Nothing is kept or marked, and
  the schema doesn't change.
- **The route answers `204` with no body.** In the typed client, `delete`
  resolves `undefined` on a 204. It is the only method that does, and it
  checks the status, not the empty body: a 204 to `get`, `post` or `put`, and
  a 200 or 201 with an empty body to any method, still throw
  `ApiUnreachableError`, so that record stays true.
- **For this route, `typecheck` doesn't check the answer.** A response with no
  `content` widens the handler's return type in `@hono/zod-openapi` 1.6.3, so
  the contract test checks that the body is empty, as the document says.

## Alternatives considered

- **Keeping the row, marked as deleted.** It would let a user undo a mistake.
  It lost because it needs:
  - a `deleted_at` column and its migration;
  - a filter in every read and write;
  - a limit on how long marked rows stay, and a deletion for them;
  - an undo route nobody has asked for.

  The web app's confirmation, in its own issue, guards against a mistake
  instead.
- **`200` with the deleted recipe's `{ id }`.** No change to how the client
  reads an answer, but a body that no caller needs and every caller could
  come to depend on.

## Consequences

- A deleted recipe can't be brought back.
- When conversations, photos or versions exist, their issues say what a
  delete does to them; `docs/product.md` already says a recipe's conversation
  goes with it.
- A route that answers with no body is held to its document by the contract
  test alone (`.claude/rules/api.md`).
