# How the app looks, moves and speaks

The look of Paste & Taste, as the owner chose it on 23 November 2026 by
reacting to ten rounds of mock-ups. The record of the choice, with what lost,
is [`docs/adr/2026-11-23-the-apps-look.md`](docs/adr/2026-11-23-the-apps-look.md).
A visual change starts here.

Each part says what is **decided** (the owner chose it), what is **proposed**
(drawn or written by the design session, shown to the owner and not objected
to, or not yet shown) and what is **open**. Nothing here is built yet: the web
app's tokens still hold placeholders, and the first screens come with their
issues.

## 1. Character

In the owner's words: easy to use above all, friendly, fun for everyone; never
serious, boring or cloying. What matters is that recipes work well, and no
flourish may hide that. The competitors' apps and several cooking sites look
too serious to him.

- **Decided:** a middle point between calm and playful. Drawings and small
  movements carry the fun; the text stays plain.
- **Decided:** its own identity. It shares the owner's taste with his personal
  site, and must not share its face: another green, another title typeface.
- The recipe itself stays calm and easy to read. The personality lives at the
  edges: the landing page, empty screens, waits, failures, small reactions.

## 2. The three moments

The app is built around three moments, and they are its spine in the
interface: **Pega** (add a recipe, in little time), **Ordena** (keep it:
classify, edit, comment, rate, share) and **Cocina** (find it and cook it,
step by step).

- **Decided:** the three are shown with one green that rises in strength, from
  the soft tint to the full accent. A colour per step was rejected. As drawn,
  they are a tag on each screen, the bottom navigation, and three numbered
  blocks on the landing page.
- **Decided:** the cooking screen shows one step at a time, like stories. It
  is drawn dark.
- **Liked by the owner:** after the last step, a tasting screen, "¡A probar!":
  how it went, a note, and saving the result as a variant.

## 3. Colour

**Decided:** one accent, a basil green, on a warm off-white. The owner's
personal site uses a nearby forest green (`#2B6F4A`); this one is yellower so
the two don't read as the same product. Food photos and drawings bring the
other colours, so the interface doesn't compete with them.

The light values are the ones the owner saw on the mock-ups. The dark column
was computed, then shown to him on three mock-ups (Añadir, Receta, Cocinar),
and he likes it, more than the light one. In light, the middle step tone and
`danger` were computed and have **not been seen on a screen** by anyone. The
names are the roles of `apps/web/src/styles/tokens.css`, plus the ones this
look adds.

| Role                    | Light     | Dark      | Used for                                  |
| ----------------------- | --------- | --------- | ----------------------------------------- |
| `surface`               | `#F5F8EC` | `#11170D` | The page                                  |
| `surface-raised`        | `#FFFFFF` | `#1A2314` | Cards, inputs, the bottom navigation      |
| `text`                  | `#1F2A17` | `#ECF3E4` | Text                                      |
| `text-muted`            | `#52603F` | `#AEBBA0` | Secondary text                            |
| `accent`                | `#3B7A1E` | `#8FD46A` | Buttons, links, step 3                    |
| `on-accent`             | `#FFFFFF` | `#11170D` | Text on the accent                        |
| accent, soft            | `#E6F1D6` | `#243319` | Step 1, the active navigation item        |
| accent, middle          | `#CBE3B0` | `#35501F` | Step 2                                    |
| accent text on soft     | `#2F6416` | `#8FD46A` | Green text on the two tones above         |
| chip                    | `#D7E9C2` | `#35501F` | Secondary buttons and filters             |
| `border`                | `#D9E0C8` | `#2C3823` | Hairlines                                 |
| control border          | `#6C7A5C` | `#8A987C` | The outline of an input                   |
| `danger`                | `#B93226` | `#FF8F80` | Errors                                    |

Contrast, computed with WCAG 2's formula, in light and in dark: `text` and
`text-muted` on both surfaces, the accent as text on both surfaces,
`on-accent` on the accent, `text` on the soft, middle and chip tones, the
accent text colour on the soft and middle tones, and `danger` on both
surfaces all reach 4.5:1; the control border reaches 3:1. The tightest in
light are the accent as text on the page (4.89:1), white on the accent
(5.27:1) and `#2F6416` on the middle tone (5.13:1). Two pairs fall just short
and are not used: the accent itself on the soft tint in light (4.49:1), which
is why green text on a tint uses `#2F6416`, and muted text on the middle tone
in dark (4.49:1). A `focus` colour is not chosen; it must reach 3:1 on both
surfaces.

- **Decided:** the app has a dark mode, with the dark column above.
- Drawing colours (tomato red, wood, yolk) are not tokens. They live in the
  drawings.

## 4. Type

- **Decided:** **Outfit** for titles and for the name (700; the name in 800),
  and **Nunito Sans** for text (400, 600, 700). Nunito, with its rounded
  stroke ends, was the first choice for titles and read as childish.
- As drawn on the mock-ups, at phone width: page title 34px, section title
  20px, text 17px, secondary text 15px, navigation labels 13px.
- **Open:** how the two families are served. It is decided with the issue
  that gives the tokens their real values.

## 5. Shape

- **Decided:** buttons, inputs, tags and filters are pills.
- **Proposed:** cards with a 28px radius, rows with 22px, controls 54px tall,
  and no shadows beyond a 2px line under a card.

## 6. Drawings

**Decided:** flat drawings of food and of kitchen utensils, with no outline
and **no faces**. Food is vegetables, fruit, legumes, bread, olives and
cheese; the utensils were the owner's idea for the friendly element.

Each drawing is one SVG on a 120 by 120 box, built from a base colour, one
darker tone on one side and one small highlight. The reference drawings are in
[`docs/design/`](docs/design):

- `food/`: tomato, pea pod, carrot, red onion, lemon, aubergine, bean, garlic,
  mushroom, avocado, strawberry, broccoli, bread, cheese, pitted olives and a
  sprig of green olives.
- `utensils/`: wooden spoon, pot, apron, salt shaker, oil cruet, mortar, pan
  with an egg, oven mitt.
- `states/`: the rating in spoons and the broken egg.
- `loaders/`: the four waits, animated as mock-ups (section 8).

The owner judged most of them one by one. Liked: the mortar, the pan, the oven
mitt and the apron. Accepted after a redraw: the cheese and the broken egg.
The red onion has no leaf, at his word.
Asked for by him: bread, olives, cheese. The two olive drawings were redrawn
from reference images he sent, and he chose them: pitted green olives, and a
sprig of green olives with leaves and olives on both sides of the branch.

**Decided, about where they go:**

- The landing page's drawing is vegetables arranged in a circle.
- **The rating is in wooden spoons**, in plain wood, instead of stars. It is
  drawn as one to three spoons, and a spoon not given is a dashed outline
  (proposed).
- **A kitchen counter that changes:** a rail with hooks and a shelf, filled
  with utensils and food.
- **When something fails, a broken egg.** Proposed copy: "Se nos han roto los
  huevos".
- **Proposed:** an apron on the empty recipe list, "Ponte el delantal y pega
  tu primera receta."
- **The owner's idea:** which drawings a screen shows depends on the screen.
  His example: starters on the login screen.

**What changes and what stays.** Decoration is drawn at random each time a
page opens: the landing drawing, the counter, the empty screen, which wait is
shown. What carries meaning never changes: the rating spoons, the failure
image, the mark. The owner hates the flicker of a server-rendered page that
changes after it loads, so the draw happens in one place and the browser
never draws it again.

## 7. Motion

**Decided:** many small animations, in the spirit of Josh Comeau's site, which
is the owner's reference. What was taken from it is the principle, read from
its public stylesheet on 23 November 2026; no component or stylesheet of his
is copied, and his licence has not been read.

The rule (proposed, and the owner liked what it produced):

- Movement answers what the person does, and lasts an instant: 0.2 to 0.5
  seconds, a few pixels, a slight overshoot when something bounces.
- About six movements are reused everywhere: hop, bounce, draw, swing, slide,
  beat. The ones shown to the owner: hanging utensils swing when the page
  loads, a drawing hops under the pointer, rating spoons arrive one by one, a
  checkbox bounces and draws its tick, a heart beats when a recipe is saved.
- Entrances are staggered. Big animations are only for waits and for entering
  a page.
- With `prefers-reduced-motion: reduce` nothing decorative moves.
- It is made as
  [`docs/adr/2026-11-23-tailwind-and-css-motion.md`](docs/adr/2026-11-23-tailwind-and-css-motion.md)
  says, with no animation library. The mock-ups move with SVG animations only
  because the design canvas needed them.

## 8. Waits

**Decided:** several waits instead of one spinner, each a kitchen action. The
verbs are proposed copy.

| Wait          | Drawing                         | What the owner asked of it                                                                 |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| "Removiendo…" | A pot seen from above, stirred  | Seen from above, with what is inside. Liked.                                               |
| "Picando…"    | A knife and a carrot            | The knife really cuts. It cuts from the thin tip; at the thick end a new carrot comes in.  |
| "Majando…"    | A mortar seen from above        | Not too full. The pestle stays inside the bowl. No verdict on the last version.            |
| "Friendo…"    | A pan with two eggs             | The pan slides, not spins; it leads and the eggs follow; two shakes, a pause, three more.  |

## 9. Voice

- **Decided:** the text leans calm: plain sentences that say what happens.
  "Pega un enlace", "Guardar receta", "Guardamos la receta ordenada, con sus
  ingredientes y sus pasos."
- The wit is kept for the edges: the waits' verbs, the failure, the empty
  list.
- All copy so far is Spanish and proposed. The English copy is not written.

## 10. The screens drawn so far

Mock-ups at phone width, plus the landing page. They show the look; they are
not specifications of what each screen does.

- **Añadir:** a field for the link, where it can be shared from, and what is
  arriving, with its wait.
- **Mis recetas:** search, filters, the list; and its empty state.
- **Receta:** in light and in dark, with a servings stepper and "+ variante".
- **Cocinar:** one step at a time, dark.
- Añadir, Receta and Cocinar again, in the dark basil palette.
- **¡A probar!:** the tasting screen.
- **Portada:** the landing page, with the circle of vegetables and the three
  steps.

They live on the owner's private design canvas, not in this repo.

## 11. Not decided

- **The mark.** The owner wants one that looks well made and has not found it.
  Until then the name set in Outfit 800 stands in for it. Routes noted: the
  initials "P&T", or the "&" as the main character. The name is itself a
  working name.
- How users relate to each other, and so what the social screens look like.
- The `focus` colour.
- How the look carries over to the native app.

## 12. Rejected, so it isn't proposed again

- The notebook direction (grid paper, ink outlines, a mustard yellow) and the
  market direction's colours (aubergine, orange, lemon: too loud). From the
  market direction the pills, the three steps and the typeface were kept.
- Terracotta and an enamel blue as the accent: the owner wants green. Among
  the greens, a bottle green was not chosen and an olive read as brown.
- A colour per step.
- Faces on food.
- As the mark: the stirring pot, a tomato with a spoon behind it, a mortar
  above the name (the competitor Pestle already uses a mortar), the "&" inside
  a frying pan, and the name in three colours.
- For a failure: a salt shaker and burnt toast.
- An artichoke, a brown onion, chickpeas beside the bean, and a spoon among
  the landing page's vegetables.
- Olives in a bowl, a pair of green olives on a twig, a sprig of black olives
  (they nearly vanish on the dark page), and a sprig with stuffed olives or
  with green and black ones together.
- A rating in spoons with red sauce.
