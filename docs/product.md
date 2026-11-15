# What the app does

The requirements the owner has stated so far. This is what the app must do;
the choices about how are in [`adr/`](adr/README.md), and each piece of work
is specified in its GitHub issue.

## The idea

A social app for people who save recipes. A recipe comes in from any digital
source, a link or a video, and the app turns it into a recipe that can be
kept, edited and cooked from. It runs as a native app and as a web app.

## Saving a recipe

- Adding a recipe from the phone is as easy as possible. Instagram and YouTube
  are two of the main sources, and web pages are the third.
- From Instagram it takes one tap, and the video and the carousel images are
  read too.
- The import runs in the background. A recipe may show as loading and be
  ready later.
- Each user has an import limit.

## Keeping and using recipes

- Store, classify, filter, share, comment on and rate recipes.
- A user can always edit a recipe.
- A note edits the recipe: the change is shown first and the previous version
  is kept.
- Favourites, and a log of "I made it". A user can add their own photos of the
  cooked dish to any saved recipe.
- The app reads a recipe aloud, to cook by listening: step by step, with large
  type and the screen kept on. Voice control comes later.
- Users, comments and sending recipes between users are part of the minimum,
  with ingredient management. Shopping baskets and weekly menus come later.

## Languages and price

- The interface is in Spanish and English from day one. Recipes stay in the
  language they were imported in.
- The app is not paid.

## Not decided

- What a rating means: a user's own recipes only, or other people's too.
- The final name. Paste & Taste is the working one.
