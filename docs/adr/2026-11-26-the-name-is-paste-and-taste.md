# The app's name is Paste & Taste

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

The owner first said it on 25 Nov 2026, asked whether the name is final:
"Paste&taste sí creo que es el nombre definitivo". What the name already rests
on that the repo can show:

- the domain `pasteandtaste.app`, bought that day
  ([the app's own domain](2026-11-25-the-apps-own-domain.md));
- the sign-in email's sender, `Paste & Taste <login@mail.pasteandtaste.app>`
  (`apps/api/src/login/resend-code-sender.ts`,
  [Resend for the sign-in code](2026-11-25-resend-for-the-sign-in-code.md)).

Trade marks, as the owner gave the facts:

- On 25 Nov 2026 the owner searched the UKIPO's trade mark search, with no
  result.
- The same day the cloud session searched TMview, across all its offices, and
  the USPTO's search. No registered mark joins the two words in the software
  classes in Great Britain, the EU, the US or WIPO. At the USPTO there are only
  similar marks, already dead.
- Not done: WIPO's own database, and a professional search for similar marks.
- The owner has registered no mark.

Another site with the same name, found by the owner on 26 Nov 2026:

- `pasteandtaste.com` is a site of the same kind, turning a recipe video into
  text.
- From public data:
  - its domain was registered on 21 Mar 2026 and expires on 21 Mar 2027;
  - it was promoted on Instagram and YouTube from 24 Mar to 6 Jun 2026, and
    not after;
  - its HTTPS certificate was last renewed on 20 Jul 2026 and expired on
    18 Oct 2026;
  - the site didn't answer on 25 or 26 Nov 2026.
- No app with that name is in the app stores (checked in Great Britain).

## Decision

The app's name is **Paste & Taste**, written so in every text. In an address
it is `pasteandtaste`, as the domain and the sender have it. The owner keeps
it knowing the facts above, confirmed on 26 Nov 2026 with the new ones.

The repository, the packages (`@paste-and-taste/…`) and the Workers keep their
`paste-and-taste` names: renaming them is not part of this decision.

## Alternatives considered

- **Keeping Paste & Taste a working name until the logo is drawn.** The logo
  and the name are separate choices, and the name already reaches people in
  every sign-in email.
- **Another name, because of `pasteandtaste.com`.** The site stopped answering
  and its promotion stopped months ago, no registered mark was found, and no
  app with the name is in the stores. The owner keeps the name and reviews it
  instead (below).

## Consequences

- The docs state the name as a fact, and the web app no longer says it is
  provisional; its footer, which only said that, is gone.
- The decision is reviewed once `pasteandtaste.com`'s registration has passed
  its expiry, 21 Mar 2027, and in any case before a public launch.
- None of this is legal advice.
- The logo is still not decided; it stays in `DESIGN.md` section 11.
