# Friends and groups, and a copy for whoever keeps a recipe

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The app is social, and sending recipes between users is part of the minimum
([`product.md`](../product.md)). How users relate was left open when the look
was chosen ([the look's record](2026-11-23-the-apps-look.md)). The owner
decided it on 24 November 2026, after the design session showed him what
four competitors do (Pestle, ReciMe, Cookpad, Samsung Food, read from their
store listings, not opened) and drew the screens on his design canvas.

What he wants, in his words: no fame, a mutual friendship between equals,
community instead of competition, and the good of social networks without
the bad. His users are his friends at first, and perhaps a few more later.
Most recipes in the app are other people's content, brought in from
Instagram or a web page.

## Decision

- **Mutual friends, and groups.** Two users are friends when one invites the
  other and the other accepts. There are no followers and no public
  profiles. Groups are where more than two people share; a friend is invited
  to a group from inside the app, and only friends can be invited that way.
  A group may hold people who aren't each other's friends.
- **Invitations by link.** Someone without an account gets a link, sent by
  WhatsApp or any other way, and makes their account from it. The app keeps
  no phone numbers.
- **A copy for whoever keeps a recipe.** Sending a recipe, or keeping one
  shared in a group, makes a copy that belongs to whoever keeps it, with
  their own tags. The copy keeps who passed it and the original link.
- **No author on screen.** The owner of each copy is kept in the data, only
  to know who may change or delete it, and is never shown as authorship.
  What each friend has passed a user is seen only by that user.
- **Leaving is easy.** A user can leave a group, remove a friend and block
  someone.

## Alternatives considered

- **Followers and public profiles**, as most social networks and some of the
  competitors have. They make some users famous and turn sharing into a
  competition, which is what the owner doesn't want.
- **Finding friends through the phone's contacts.** It was the owner's first
  idea. It means storing phone numbers, and asking for them is a nuisance;
  a link sent by WhatsApp reaches the same people.
- **One shared recipe that every friend points to**, instead of copies. A
  change by one person would change it for all, and deleting it would take
  it from everyone. The owner wants each person to keep and change their own.
- **Inviting a friend to a group by WhatsApp link too.** Inside the app is
  simpler for someone who already has an account; the link stays for whoever
  has none.
- **A public ranking of recipes with the users' names.** The owner's idea,
  dropped in that form because names bring back fame. A list of the most
  saved recipes, with no names, is left for later.

## Consequences

- The first table that holds recipes carries an owner and who may see each
  recipe, a shape the owner agreed to. Who may see one is proposed as three
  audiences, not yet decided: only its owner, the friends it was sent to, or
  the groups it was shared in.
- Search engines find only what is public: the landing page and what the web
  app shows without an account. User recipes are never listed publicly.
- A sent recipe is copied, so storage grows with every copy; with a few
  friends this costs little, and it is watched when the users grow.
- Counts per person (how many recipes a friend has passed) exist only for the
  user they belong to. Showing them to anyone else would make a scoreboard.
