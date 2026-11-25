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
| 1   | The API's base                | Done        | [#35](https://github.com/julian-palomo/paste-and-taste/issues/35)      |
| 2   | The Instagram prototype       | In progress | [#22](https://github.com/julian-palomo/paste-and-taste/issues/22)      |
| 3   | Database and login            | In progress | [#42](https://github.com/julian-palomo/paste-and-taste/issues/42), [#58](https://github.com/julian-palomo/paste-and-taste/issues/58) |
| 4   | The first recipe, end to end  | In progress | [#46](https://github.com/julian-palomo/paste-and-taste/issues/46)      |
| 5   | The real import               | Not started |                                                                        |
| 6   | The native app                | Not started |                                                                        |
| 7   | What makes the product        | Not started |                                                                        |

## The phases

1. **The API's base.** The API's skeleton is in place, with its contract and
   the typed client that the web app and the native app will call. The
   deploy pipeline, #35, deploys a merge to `main` from GitHub Actions: the
   checks, then preview, then production, each deploy smoke-tested. The phase
   is done: the pipeline's first deploy went green on 22 November 2026.
2. **The Instagram prototype.** Reading a post with one tap, its video and its
   carousel images included, is the requirement that matters most and the one
   least sure to be possible. The prototype is throwaway code, outside the
   app. Its result decides the AI provider and how the import is designed, so
   it comes before anything is built on either.
3. **Database and login.** Where Postgres lives and which ORM talks to it, the
   first table with its migrations, and Better Auth, which needs the database.
   It starts with a spike, #42: login with Better Auth through Hyperdrive,
   measured from a deployed Worker on Neon's free plan and on PlanetScale's
   smallest node, before anything is built on either. Hashing a password
   took far more CPU than the free plan allows, so #58 measures login without
   a password, by a code sent by email and by passkey, on the same Worker.
   The first table holds an owner and who may see each recipe
   ([the record](adr/2026-11-24-friends-groups-and-copies.md)).
4. **The first recipe, end to end.** A table, its endpoints, and the web app
   in TanStack Start with one screen that lists a recipe, opens it and edits
   it, in Spanish and English. A service and a repository appear in the API
   here for the first time. The web app's skeleton came first, #46, while
   phase 3 is in progress, because it needs neither the database nor login:
   one page rendered on the server, in both languages, that shows the API's
   health through the typed client. Since #48 the pipeline deploys it after
   the API, to preview and production. Since #50 it has the base the first
   screen is built on: Tailwind CSS from one tokens file, a layout every page
   shares, and its own error and not-found pages. Since #54 the tokens hold the
   look's colours, light and dark, and its two typefaces.
5. **The real import.** Workflows in the background and the limit per user.
   Web pages first, the cheapest source to read, then Instagram, then YouTube.
6. **The native app.** Android first, with sharing a post to the app. iPhone
   is tested early.
7. **What makes the product.** Tags, editing a recipe with a note, a user's
   own photos, the cooking mode that reads aloud, and the social part:
   friends and groups, sending recipes as copies, the conversation on each
   recipe, and rating.
