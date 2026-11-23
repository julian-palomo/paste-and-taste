# The app's look: a basil green, Outfit and Nunito Sans, flat food and utensils

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The web app had a styling base and no look: its tokens hold neutral
placeholders
([the record](2026-11-23-tailwind-and-css-motion.md)), and the first recipe
screens are next. The owner wants the app easy above all, friendly and fun
for everyone, never serious or boring, with its own identity: his personal
site is warm, rounded and green too, and the two must not look like one
product. The competitors' apps he was shown are white pages with screenshots
and one accent colour, and look too serious to him.

The look was chosen by rounds: the design session drew options on real
screens, the owner reacted, and the next round kept what he liked. Ten
rounds, all on 23 November 2026.

## Decision

The owner decided, on 23 November 2026, what [`DESIGN.md`](../../DESIGN.md)
now holds. In short:

- One accent, a basil green (`#3B7A1E`), on a warm off-white, with a dark
  mode.
- Outfit for titles and the name, Nunito Sans for text.
- Pills for buttons and inputs.
- Flat drawings of food and kitchen utensils, without faces. A rating in
  wooden spoons, a kitchen counter that changes, a broken egg when something
  fails.
- The three moments, Pega, Ordena and Cocina, shown with one green that rises
  in strength.
- Many small animations that answer what the person does, and several waits,
  each a kitchen action.
- A middle point between calm and playful, with plain text.

The mark is not decided; the name set in Outfit stands in for it.

## Alternatives considered

- **A notebook look** (grid paper, ink outlines, a mustard yellow,
  handwritten notes). The owner dislikes that yellow and the designs it
  reminds him of.
- **A market look** (aubergine, orange and lemon blocks, big numerals). Too
  loud. Its pills, its three steps on the landing page and, later, its title
  typeface were kept.
- **Nunito for titles**, the first choice. Its rounded stroke ends, added to
  pills, drawings and bounces, read as childish.
- **Inter for text**, as the market look had. It is the text typeface of the
  owner's personal site, so Nunito Sans stayed.
- **The first green** (`#2A7548`), almost the green of his personal site
  (`#2B6F4A`). Also a terracotta and an enamel blue, which lost because he
  wants green, a bottle green, and an olive green, which read as brown.
- **A colour per step** instead of one green rising. Rejected by the owner.
- **Faces on the food.** Rejected by the owner.
- **A calmer level** (no drawings, plain spinner) and **a more playful one**
  (big moving drawings, puns in the titles). He chose the middle, with the
  text nearer the calm one.
- **Stars for the rating**, and one spinner for every wait.

## Consequences

- `DESIGN.md` is where a visual change starts. A change of mind about the
  look is a new record and an edit there.
- The tokens still hold placeholders. Giving them these values is its own
  issue, and brings two things with it: how the two typefaces are served, and
  the roles this look adds (the soft and middle accent tones, the chip, the
  control border).
- The dark palette was computed for contrast and then shown to the owner on
  three mock-ups, and he likes it. The light middle step tone and the light
  `danger` were computed and never seen on a screen. They are checked when
  the first screen is built.
- The reference drawings are in `docs/design/` as SVG. In the app each one
  becomes a component or a file, decided with the first screen that shows
  one. The four waits there move with SVG animations; the app makes them as
  the motion record says.
- Decoration drawn at random has to be chosen once, in one place, so the
  server's HTML and the browser agree and the page doesn't flicker when it
  loads.
- The mark, the social screens and the English copy are not designed.
