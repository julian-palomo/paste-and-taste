# Glossary

One word for each of the app's own concepts. Issues, plans, tests, code names
and docs use these words, so the same thing is never called two names. A new
concept, or a sharper word for one, is added here in the same pull request
that brings it. Older docs and the decision records keep the words they were
written with.

Each entry gives the term, the Spanish word the app shows where the design or
the owner has decided it, what the concept is, and the words not to use for
it. A word still undecided is marked open.

## Recipes

**Recipe** (receta): A dish's ingredients and steps in the app's one format,
which a user keeps, edits and cooks from.\
_Avoid_: post, entry.

**Source**: Where a recipe came from: an Instagram post, a YouTube video or a
web page, kept as its link.\
_Avoid_: origin.

**Import**: Making a recipe from a source's link. It runs in the background.
The app's button says "Guardar receta".\
_Avoid_: scrape, parse (as names for the whole step).

**Import limit**: How many imports a user may make.\
_Avoid_: quota.

**Tip**: What a post teaches that isn't a recipe. It is saved like one and
marked with a tag. Spanish word: open.\
_Avoid_: hack, trick.

**Variant**: Another form of a recipe that lives beside it, with
ingredients changed or added or the steps in another order.\
_Avoid_: version (see Note).

**Note**: What a user writes to change their recipe; a model rewrites the
recipe with it, and the earlier **version** is kept.\
_Avoid_: comment, annotation; and "note" for the text sent with a recipe,
which is the conversation's first message.

**Servings**: How many people a recipe is for.\
_Avoid_: portions, yield.

**Ingredient** (ingrediente): What a recipe uses, with its quantity and unit
when the source gives them.

**Step** (paso): One instruction of a recipe, in its order.\
_Avoid_: instruction (as the name for one), direction.

**Time** (tiempo): How long a recipe takes, as its source states it.\
_Avoid_: duration, cook time (for the whole).

**Photo**: A picture on a recipe, from its source or added by a user.\
_Avoid_: image (kept for the app's own drawings).

**Tag** (etiqueta): A word on a recipe that groups it with others. A **fixed
tag** comes with the app and is the same for everyone; an **own tag** is one a
user adds; a **pinned tag** shows at the top of a user's recipes.\
_Avoid_: folder, category, label.

**Rating**: Wooden spoons on a recipe. What it means is open.\
_Avoid_: score, stars.

**Recipe book** (recetario): All the recipes a user keeps.\
_Avoid_: library, collection, cookbook.

## People

**User**: A person with an account.\
_Avoid_: member, customer.

**Account** (cuenta): A user's name, email address, sign-in and avatar photo.
Better Auth's own table of that name is `auth_account` in the database and
`authAccount` in code, and is never shown.

**Sign-in code** (código): The six digits sent to a user's email address to
sign in. It lasts 5 minutes and allows 3 tries.\
_Avoid_: OTP, token, PIN (in the app's words; OTP stays in Better Auth's own
names).

**Passkey**: A key a user's device keeps, offered after signing in with a
code, to sign in the next times without one. Spanish word: open.\
_Avoid_: biometrics, fingerprint login.

**Session** (sesión): A user signed in on one device, kept by a cookie. It
lasts while the app is open, or 90 days from its last use with **Mantener la
sesión iniciada** ticked, the box at sign-in.\
_Avoid_: login (for the session itself).

**Friend** (amigo, amiga): A user joined to another by a mutual friendship.\
_Avoid_: follower, contact, connection.

**Friend request**: One user asking another to be friends.

**Invitation link**: A link that brings someone without an account into the
app, sent by WhatsApp or any other way.\
_Avoid_: invite code.

**Group invitation** (invitación): An invitation, inside the app, for a friend
to join a group.

**Group** (grupo): Users who share recipes; it may hold people who aren't each
other's friends.\
_Avoid_: channel, circle, community.

**People tab**: The tab with friends, groups and what has arrived. Its Spanish
word is open ("Mi gente" is drawn as a trial).

## Passing recipes

**Send** (enviar): Pass a recipe to a friend.\
_Avoid_: share (for friends).

**Share** (compartir): Put a recipe in a group.\
_Avoid_: post, publish.

**Shared link**: A recipe's link that anyone can read without an account.\
_Avoid_: public link.

**Copy** (copia): The recipe a user keeps from one sent or shared, theirs to
change, with their own tags.\
_Avoid_: clone, fork, duplicate.

**Copy owner**: The user a copy belongs to. Kept in the data to know who may
change or delete it, and never shown.\
_Avoid_: author, creator, and a bare "owner", which in these docs means the
repo owner.

**Passed by**: The user who sent or shared the recipe a copy was made from.\
_Avoid_: author, from.

## Talking about a recipe

**Conversation** (conversación): All the messages that hang from one recipe.
There is no free chat.\
_Avoid_: chat, thread, channel.

**Message** (mensaje): One thing a user writes in a conversation. What a user
writes when sending or sharing a recipe is its conversation's first message.
The app's buttons say "Comentar" in a group and "Responder" between friends.\
_Avoid_: comment, note (as names for it).

## Running the app

**Wake request**: The cheap request an app sends when it or any of its pages
opens, so the database, which sleeps when idle, is awake by the time the user
acts. The API answers it at `/wake`. Never shown in the app.\
_Avoid_: ping, warm-up, keep-alive.
