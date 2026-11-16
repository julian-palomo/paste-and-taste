# How an Instagram post is read

- **Status:** Proposed
- **Date:** 2026-11-16

## Context

From Instagram, saving a recipe takes one tap, and the video and the carousel
images are read too ([`product.md`](../product.md)). The import runs on
Cloudflare's network ([Cloudflare Workflows](2026-11-15-cloudflare-workflows.md)),
and nobody's Instagram login is used.

A spike measured three routes that read a public post with no login (the embed
view, oEmbed with no token and the post's page; a fourth, the web app's
logged-out query, is described in the report and was not run), for 20
posts of the owner's, from the owner's machine and from Cloudflare's network,
on 16 Nov 2026. The figures, and what Meta's terms say, are in
[`docs/research/instagram-reading.md`](../research/instagram-reading.md). In
short, for the 18 public posts whose kind is known, all of them reels:

- The public embed view returned the caption for 18 of 18 in both places, and
  a video address for 10 of 10 reels with their own audio and 2 of 8 that the
  embed view doesn't mark as original audio, in about half a second.
- oEmbed, callable with no token since May 2026, answered every time with no
  caption and no video.
- The post's page held no post data from either place, and from Cloudflare
  it sent 5 of 8 requests to the login page.
- The sample had no carousel and no single image.
- Meta's Automated Data Collection Terms, Instagram's Terms of Use and its
  robots.txt forbid automated collection without Meta's express written
  permission, with or without a login.

## Decision

Proposed: the import reads an Instagram post through its **public embed view**,
from Cloudflare's network, with no login: one request per post for the
caption and, when the post offers one, the video's address. A reel with no
video address is imported from its caption alone.

Recommended because it is the only route measured that returns the caption
and a video, and it worked the same from Cloudflare as from a home
connection. The owner decides it knowing the cost below, the terms first.

## Alternatives considered

- **oEmbed, with no token.** Documented and allowed with no app, but it
  returned no caption and no video for any post, and its own terms forbid
  using its answer for anything but showing the embed.
- **The post's own page.** Held no post data, and from Cloudflare it redirects
  to the login page.
- **The logged-out GraphQL query** the web page calls. It replays the web app's
  session over three requests, and yt-dlp only sends it while imitating a
  browser. Ruled out by the owner, not measured.
- **Business Discovery and the other Graph API routes.** Each needs a Meta app
  and someone's login, and Business Discovery finds posts by username, not by
  link. Not measured.
- **Asking Meta for written permission.** The terms name it as the condition
  for automated collection. Not explored; it would make any route a
  permitted one, and nothing says Meta grants it to an app like this.
- **No automatic reading from Instagram**: the user pastes the recipe
  themselves. Keeps clear of the terms, and gives up the one tap.

## Consequences

- **The terms.** Reading the embed view this way is automated collection,
  which Meta's terms forbid without its written permission. That is a risk to
  the app and its Cloudflare account, which the owner accepts or not; this
  record doesn't settle it.
- **It can break without notice.** The route is undocumented: the post's data
  is JSON inside a string inside a script, in a shape Instagram doesn't
  promise. The import needs a check that notices when the caption stops
  coming.
- **Reels with someone else's audio.** 6 of the 8 reels the embed view doesn't
  mark as original audio gave no video address, so for most of them the recipe
  has to come from the caption. Whether that audio is licensed music was not
  checked. Whether the caption is enough is #24's question.
- **Carousels are unknown.** The requirement to read a carousel's images has
  no measurement yet; a sample with carousels has to be measured before the
  import is built on this.
- **Video addresses are unchecked.** No video was downloaded, so whether an
  address works from Cloudflare, and for how long, is still to measure.
- **Private posts can't be read**, and the embed view answers them with a page,
  not an error, so the import has to recognise it.
- **Cost.** One request per post, about 0.5 seconds from Cloudflare, and no
  money.
