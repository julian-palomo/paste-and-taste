# Recipes are organised with tags, not folders

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Adding a recipe will be easy, so a user will have many. The owner wants an
efficient, comfortable way to keep, classify, group, filter and search them,
and asked whether a tree of folders would do it. Recipes already have tags,
some that come with the app ("made", "favourite") and the user's own
([`product.md`](../product.md)).

## Decision

No folders. Recipes have tags of two kinds: a few fixed ones that come with
the app, the same for everyone, and each user's own. A user pins the tags
they want, and pinned tags are shown at the top of their recipes. One
recipe can be under several tags at once.

The owner chose it on 24 November 2026: folders and tags together are too
much. Fixed tags next to editable ones were his idea; pinned tags were the
design session's proposal, and he liked them.

## Alternatives considered

- **A tree of folders.** A recipe lives in several places at once (a quick
  dinner that is also a legume dish), and a tree forces one folder or a
  duplicate. On a phone a tree means going in and out of levels, where a
  filter is one tap. When adding is easy and filing is a chore, recipes end
  up unfiled.
- **Folders and tags together.** Two systems for one job, each to learn.

## Consequences

- Finding a recipe rests on search and filters over the tags, so both have
  to be fast and simple.
- The fixed tags are chosen carefully, since every user gets them. A first
  list is in [`product.md`](../product.md), and it is provisional.
- Moving later from tags to nested folders stays possible; going the other
  way would be much harder.
