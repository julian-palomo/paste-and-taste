# The conversation hangs from the recipe

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Users send recipes to friends and share them in groups
([the friends and groups record](2026-11-24-friends-groups-and-copies.md)),
and comments are part of the minimum ([`product.md`](../product.md)). The
owner asked for channels of their own: a common one per group, perhaps like
a WhatsApp group, and private ones to pass recipes without WhatsApp. The
first invitation still goes by WhatsApp.

## Decision

In the first version there is no chat. Every conversation hangs from a
recipe: a recipe shared in a group has its comments, and a recipe sent to a
friend can go with a note that starts the conversation between the two
about it. A user edits and deletes their own messages, an edited one says
so, and deleting a recipe deletes its conversation.

The owner chose it on 24 November 2026, on a decision card.

## Alternatives considered

- **A chat like WhatsApp's**, one per group and one per pair of friends. It
  competes with WhatsApp, which everyone already uses, and pulls the app away
  from recipes. It needs messages delivered at once, notifications, unread
  counts and stored private conversations. On Cloudflare, real time would
  need Durable Objects, which are neither set up nor studied for this app.
- **Messages in a group that hang from no recipe**, to suggest and talk about
  meals, delivered when the page is opened rather than at once. The owner
  likes the idea and leaves it out for now.
- **Conversations that delete themselves** after a while. It doesn't remove
  any of the work above.

## Consequences

- A message belongs to a recipe, so it is stored with the recipe's id, and
  who can read it follows who can see the recipe.
- Nothing needs to arrive in real time: a conversation is read when the
  recipe is opened.
- The people tab counts what is new, and a new comment isn't counted
  ([`product.md`](../product.md)), so comments need no unread counter of
  their own in the first version.
