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
| 3   | Database and login            | In progress | [#42](https://github.com/julian-palomo/paste-and-taste/issues/42), [#58](https://github.com/julian-palomo/paste-and-taste/issues/58), [#66](https://github.com/julian-palomo/paste-and-taste/issues/66), [#69](https://github.com/julian-palomo/paste-and-taste/issues/69), [#80](https://github.com/julian-palomo/paste-and-taste/issues/80), [#77](https://github.com/julian-palomo/paste-and-taste/issues/77), [#90](https://github.com/julian-palomo/paste-and-taste/issues/90), [#93](https://github.com/julian-palomo/paste-and-taste/issues/93) |
| 4   | The first recipe, end to end  | Done        | [#46](https://github.com/julian-palomo/paste-and-taste/issues/46), [#73](https://github.com/julian-palomo/paste-and-taste/issues/73), [#98](https://github.com/julian-palomo/paste-and-taste/issues/98), [#85](https://github.com/julian-palomo/paste-and-taste/issues/85), [#96](https://github.com/julian-palomo/paste-and-taste/issues/96) |
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
   It started with a spike, #42: login with Better Auth through Hyperdrive,
   measured from a deployed Worker on Neon's free plan and on PlanetScale's
   smallest node, before anything is built on either
   ([the report](research/login-on-workers.md)). Hashing a password took far
   more CPU than the free plan allows, so #58 measured login without a
   password, by a code sent by email and by passkey, on the same Worker
   ([the report](research/passwordless-login.md)). The owner decided both on
   25 November 2026: Postgres on Neon
   ([the record](adr/2026-11-25-database-host-and-drizzle.md)) and login
   without a password ([the record](adr/2026-11-25-login-without-a-password.md)),
   with Workers moving to the paid plan when the login is deployed. The
   phase's next issues are written from them. The first, #66, connects the
   API to Postgres on Neon through Hyperdrive, with a wake route that every
   deploy's smoke calls. #67 has the web app's server send the wake request on
   every page load. #69 adds the login to the API, in development only: a
   code by email, printed in the terminal there, and an optional passkey, with
   Better Auth behind the API's own routes and its tables under the app's
   migrations. #80 lets the typed client post, send the browser's headers
   and hand back the API's cookies, which the web app's server relays. #77
   adds the sign-in page to the web app, in development only: a code by
   email, the "Mantener la sesión iniciada" box, and a passkey. #87 sends the
   code by email through Resend, from `mail.pasteandtaste.app`. #84 deletes
   the login's expired rows once a day, on a Cron Trigger. #88 puts both
   Workers on `pasteandtaste.app`, the domain the login is deployed on. #105
   closes sign-up to invited addresses until launch and caps the codes sent
   in a day. Next comes
   the login in preview and production, with Workers Paid and a Resend
   webhook that alerts on failed and bounced emails.
   The first table, a user's recipes, holds each recipe's copy owner; who
   else may see a recipe comes with sending and sharing, in their own issue
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
   look's colours, light and dark, and its two typefaces. Since #74 it has the
   first pieces its screens are built from, a button, a text field, a
   checkbox and a card, and a page that shows them in development and
   preview. Since #98 production's home says the app is being built, and the
   health has its own page, which the deploy's smoke reads. #73 is the API's half: a user's recipes in Postgres, listed,
   opened, added and edited through the API, in development, with the first
   service and repository
   ([the record](adr/2026-11-25-ingredients-and-steps-as-jsonb.md)). Since #83
   the typed client reaches every recipes route, a path's `{id}` and `put`
   included. #95 deletes a recipe in the API and the client, removing its row.
   Since #85 the web app has the recipe pages, in development: the list, a
   recipe, and one form to add one by hand or edit it, which works with no
   JavaScript. Since #96 a recipe can be deleted from its page, after a
   confirmation.
5. **The real import.** Workflows in the background, the limit per user, and
   a daily ceiling on imports for the whole app.
   Web pages first, the cheapest source to read, then Instagram, then YouTube.
6. **The native app.** Android first, with sharing a post to the app. iPhone
   is tested early.
7. **What makes the product.** Tags, editing a recipe with a note, a user's
   own photos, the cooking mode that reads aloud, and the social part:
   friends and groups, sending recipes as copies, the conversation on each
   recipe, and rating.
