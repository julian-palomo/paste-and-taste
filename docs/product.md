# What the app does

The requirements the owner has stated so far. This is what the app must do;
the choices about how are in [`adr/`](adr/README.md), and each piece of work
is specified in its GitHub issue.

## The idea

A social app for people who save recipes. A recipe comes in from any digital
source, a link or a video, and the app turns it into a recipe that can be
kept, edited and cooked from. It runs as a native app and as a web app.

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

## Keeping and using recipes

- Store, classify, filter, share, comment on and rate recipes.
- A recipe has tags. Some come by default, such as "made" and "favourite",
  and a user adds their own.
- A user can always edit a recipe.
- A note edits the recipe: the change is shown first and the previous version
  is kept.
- A user can add their own photos of the cooked dish to any saved recipe.
- The app reads a recipe aloud, to cook by listening: step by step, with large
  type and the screen kept on. Voice control comes later.
- Users, comments and sending recipes between users are part of the minimum,
  with ingredient management. Shopping baskets and weekly menus come later.

## Languages and price

- The interface is in Spanish and English from day one. Recipes stay in the
  language they were imported in.
- The app is not paid.

## Not decided

- Whether a link that fails is sent to us on its own or only when the user
  reports it.
- Whether a picture from the post is kept with the recipe.
- Whether users share their tags with each other.
- Whether "made" is only a tag or also keeps a dated log of each time.
- What a rating means: a user's own recipes only, or other people's too.
- The final name. Paste & Taste is the working one.
