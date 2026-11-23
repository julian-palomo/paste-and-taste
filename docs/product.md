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

## Keeping and using recipes

- Store, classify, filter, share, comment on and rate recipes.
- A recipe has tags. Some come by default, such as "made" and "favourite",
  and a user adds their own.
- A user can always edit a recipe. Text can also be added by voice, with a
  microphone.
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

## Languages and price

- The interface is in Spanish and English from day one. Recipes stay in the
  language they were imported in.
- The app is not paid.

## Using the app

- The app is easy to use above all, friendly, and fun for everyone.
- It has a dark mode.

## The web app

- Its pages are rendered on the server, so search engines can read them.

## Not decided

- Whether a link that fails is sent to us on its own or only when the user
  reports it.
- How a tip is kept apart from a recipe, beyond its tag.
- What a post that holds several recipes becomes. One of the owner's sample
  posts has three.
- Whether users share their tags with each other.
- Whether "made" is only a tag or also keeps a dated log of each time.
- What a rating means: a user's own recipes only, or other people's too.
- What a visitor who isn't logged in sees on the web.
- How the app teaches a new user. Perhaps the page before login explains it
  with screenshots and vignettes, and another way inside.
- How users relate to each other: in groups, or with a public and a private
  part for each user. Keeping a photo in a private recipe book is not the
  same as showing it to everyone.
- The final name. Paste & Taste is the working one.
