# Roadmap

The order the work is expected to take, agreed by the owner on 16 November
2026. It is a plan, not a record: when the order changes, this file is edited.
What the app must do is in [`product.md`](product.md), why each choice was
made is in [`adr/`](adr/README.md), and each piece of work is specified in its
GitHub issue.

There are no dates. A phase starts when the one before has given what it
needs, and a phase gets its issues when it is next.

| #   | Phase                         | State       | Issues                                                                 |
| --- | ----------------------------- | ----------- | ---------------------------------------------------------------------- |
| 1   | The API's base                | In progress | [#35](https://github.com/julian-palomo/paste-and-taste/issues/35)      |
| 2   | The Instagram prototype       | In progress | [#22](https://github.com/julian-palomo/paste-and-taste/issues/22)      |
| 3   | Database and login            | Not started |                                                                        |
| 4   | The first recipe, end to end  | Not started |                                                                        |
| 5   | The real import               | Not started |                                                                        |
| 6   | The native app                | Not started |                                                                        |
| 7   | What makes the product        | Not started |                                                                        |

## The phases

1. **The API's base.** The API's skeleton is in place, with its contract and
   the typed client that the web app and the native app will call. What is
   left is the deploy pipeline: the owner chose a GitHub Actions job, and
   #35 builds it.
2. **The Instagram prototype.** Reading a post with one tap, its video and its
   carousel images included, is the requirement that matters most and the one
   least sure to be possible. The prototype is throwaway code, outside the
   app. Its result decides the AI provider and how the import is designed, so
   it comes before anything is built on either.
3. **Database and login.** Where Postgres lives and which ORM talks to it, the
   first table with its migrations, and Better Auth, which needs the database.
4. **The first recipe, end to end.** A table, its endpoints, and the web app
   in TanStack Start with one screen that lists a recipe, opens it and edits
   it, in Spanish and English. A service and a repository appear in the API
   here for the first time.
5. **The real import.** Workflows in the background and the limit per user.
   Web pages first, the cheapest source to read, then Instagram, then YouTube.
6. **The native app.** Android first, with sharing a post to the app. iPhone
   is tested early.
7. **What makes the product.** Tags, editing a recipe with a note, a user's
   own photos, the cooking mode that reads aloud, and the social part:
   sharing, commenting and rating.
