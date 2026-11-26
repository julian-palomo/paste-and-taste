# What the app does

The requirements the owner has stated so far. This is what the app must do;
the choices about how are in [`adr/`](adr/README.md), how it looks is in
[`DESIGN.md`](../DESIGN.md), and each piece of work is specified in its
GitHub issue.

## The idea

A social app for people who save recipes. A recipe comes in from any digital
source, a link or a video, and the app turns it into a recipe that can be
kept, edited and cooked from. It runs as a native app and as a web app.

Recipes are scattered over social networks and blogs; the app brings them
into one format that is easy to store and share. It has three moments:
adding a recipe, which should take little time; organising it; and finding
it and cooking it.

The social part is for whoever wants it, among friends: community, not
competition. Nobody becomes famous in it.

## Saving a recipe

- Adding a recipe from the phone is as easy as possible, from any source.
  Instagram and YouTube are two of the main ones.
- From Instagram it takes one tap, and the video and the carousel images are
  read too.
- The import runs in the background. A recipe may show as loading and be
  ready later.
- Each user has an import limit.
- When a link can't be imported, the user can tell us, and we look at it.
  The app also has a way to send feedback.
- A video downloaded to read a post is deleted once the recipe has been made
  from it. The app keeps the recipe, not the video.
- A post can be a cooking tip instead of a recipe. The app saves it too, and
  a tag marks it as a tip.
- A post that holds several recipes creates several recipes, one for each.

## Keeping and using recipes

- Store, classify, group, filter, search, share, comment on and rate
  recipes. Adding a recipe is easy, so finding one among many must be easy
  and comfortable too.
- Recipes are organised with tags, not with folders
  ([the record](adr/2026-11-24-tags-not-folders.md)). A few fixed tags come
  with the app, the same for everyone and chosen carefully, such as "made"
  and "favourite"; each user adds their own. A user pins the tags they want
  at the top of their recipes.
- A user can always edit a recipe. Text can also be added by voice, with a
  microphone.
- A user can add a recipe by hand, writing its title, ingredients and steps,
  besides importing one from a link.
- A recipe has variants: another version of it, with ingredients changed or
  added, or the steps in another order.
- The number of servings of a recipe can be changed.
- A note edits the recipe: the change is shown first and the previous version
  is kept.
- A recipe has pictures: the ones that come with the post or the page it was
  imported from, and the photos a user adds, such as their own of the cooked
  dish. Adding and deleting a recipe's photos is easy.
- The app reads a recipe aloud, to cook by listening: step by step, with large
  type and the screen kept on. Voice control comes later.
- Users, comments and sending recipes between users are part of the minimum,
  with ingredient management. Shopping baskets and weekly menus come later.
- Later, a user can connect their recipe book to an AI assistant, such as
  Claude or ChatGPT, and use their recipes from there.
- The app has a sample recipe of its own, and it can be sent to someone.

## Friends and groups

How people meet and pass recipes is recorded in
[the record](adr/2026-11-24-friends-groups-and-copies.md).

- Friendship is mutual, between equals. There are no followers.
- A friend joins by invitation. Someone without an account gets a link, sent
  by WhatsApp or any other way. The app keeps no phone numbers.
- Groups are where the community lives. A friend is invited to a group from
  inside the app, and only friends can be invited that way. A group may hold
  people who aren't each other's friends.
- A user can leave a group, remove a friend and block someone.
- Whoever keeps a recipe, sent by a friend or shared in a group, gets their
  own copy, with their own tags, which they change as they like.
- No recipe shows an author. Most recipes were brought in from somewhere
  else, and the app is for sharing. The owner of each copy is kept in the
  data, only to know who may change or delete it.
- Every copy keeps who passed it and the link to where it came from, such as
  the Instagram post or the web page.
- What each friend has passed a user, such as five recipes from Ana, is seen
  only by that user: on the friend's page, as a filter among their recipes,
  and with the friends they exchange most with first when sending.
- A recipe shared by link can be read by anyone with the link, without an
  account ([the record](adr/2026-11-24-a-shared-link-is-readable-without-an-account.md)).

## Talking about a recipe

- The conversation hangs from the recipe; there is no free chat
  ([the record](adr/2026-11-24-the-conversation-hangs-from-the-recipe.md)).
  A recipe shared in a group has its comments, and a recipe sent to a friend
  can go with a note that starts its conversation.
- A user edits and deletes their own messages, and an edited message says
  so. When a recipe is deleted, its conversation goes with it.
- The people tab shows counts of what is new: friend requests, invitations
  to a group, a recipe a friend sends, and a recipe shared in a group. A new
  comment doesn't count. A count goes once it has been seen, and there are no
  totals.

## The account

- An account holds a name and an email address, and nothing else that has to
  be filled in: no address, no phone. The profile is made by the recipes.
- A user signs in with a code sent to their email address. Once signed in,
  the app offers a passkey for the next times; it is optional, and on a new
  device the code is the way in again. There is no password and no Google
  ([the record](adr/2026-11-25-login-without-a-password.md)).
- When the app offers a passkey, a short message explains what it is, for
  whoever distrusts it.
- The sign-in screen shows the address the code was sent to, a button to send
  it again after a wait, and a reminder to look in spam.
- When the code doesn't arrive, a "No me llega el código" link on the sign-in
  screen opens a short form, the feedback form with the reason "No puedo
  entrar", protected against spam. There is no published email address for
  it.
- One email address, one account.
- A user can change their email address.
- A session lasts while the app is open. At sign-in, a "Mantener la sesión
  iniciada" box, unchecked, lets the user stay signed in; otherwise they are
  asked for their passkey or a code again
  ([the record](adr/2026-11-24-staying-signed-in.md)). Ticked, the session
  lasts 90 days from its last use
  ([the record](adr/2026-11-25-a-remembered-session-lasts-90-days.md)).
- A user has an avatar photo.
- Settings are as simple as possible. They include choosing how the app
  looks: like the device, light or dark.

## Languages and price

- The interface is in Spanish and English from day one. Recipes stay in the
  language they were imported in.
- The app is not paid.

## Privacy

- The app follows the rules of the UK and of Spain on cookies and privacy,
  the stricter of each where they differ, and aims to need no cookie banner.

## Using the app

- The app is easy to use above all, friendly, and fun for everyone.
- It has a dark mode.

## The web app

- Its pages are rendered on the server, so search engines can read them.

## Not decided

- Whether a link that fails is sent to us on its own or only when the user
  reports it.
- How a tip is kept apart from a recipe, beyond its tag.
- Which fixed tags the app has. A first list the owner finds fine for now:
  favourite, made; starter, main, side, dessert, breakfast, drink, sauces and
  basics; recipe or tip. In that list, time, servings and the main ingredient
  are fields of a recipe, not tags.
- Whether users share their own tags with each other.
- Whether "made" is only a tag or also keeps a dated log of each time.
- What a rating means: a user's own recipes only, or other people's too.
- Messages in a group that hang from no recipe, to suggest and talk about
  meals. The owner likes them and leaves them out for now.
- A public part of the web, later: a list of the most saved recipes, with no
  user's name, and recipes whose owner chooses to publish them.
- What else a visitor who isn't logged in sees on the web, besides a recipe
  shared by link.
- How the app teaches a new user. Perhaps the page before login explains it
  with screenshots and vignettes, and another way inside.
- How a change of email address is confirmed (proposed: the new address is
  verified before the change, and the old one is told).
- How a user who loses access to their email address gets back in.
- What the native app does that the web app doesn't. The owner sees sharing a
  post from Instagram as the main one, and perhaps Facebook or TikTok later.
- The final name. Paste & Taste is the working one.
