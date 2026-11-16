# What a public Instagram link gives without a login

A spike's report: for the owner's sample of posts, which ways of reading a
public Instagram link return the caption, the video and the carousel images
with no login, how often and how fast, from the owner's machine and from
Cloudflare's network. The code that measured it is throwaway, in
[`prototypes/instagram`](../../prototypes/instagram/README.md); this report
stays. The decision it informs is proposed in
[`docs/adr/2026-11-16-how-an-instagram-post-is-read.md`](../adr/2026-11-16-how-an-instagram-post-is-read.md).

Every figure here is a measurement from one run in each place, unless it says
otherwise. What Meta's documents say is a reading for the owner to decide with,
not legal advice.

## How it was measured

- **The sample.** 20 posts chosen by the owner: 19 public and 1 private (post
  19), which is left out of the totals. On the reviewer's first look, 15 were
  in Spanish, 2 in English, 1 in German and 1 in French. **The sample has no
  carousel and no single image**, so nothing below says how either is read.
- **The kinds.** Nobody sorted the posts by watching them. The reviewer
  assigned the kinds on 16 Nov 2026, about 16:00 UTC, from the embed view's own
  data: `reel-own-audio` where the post's `uses_original_audio` was true (10),
  `reel-music` where it was false (8), and `unknown` where the field was
  missing (post 13) or the post couldn't be read (post 19). So "licensed music"
  below means "not marked as original audio": it may be another creator's
  audio, and what the audio is was not checked. The kind comes from the route
  R1 measures, which the plan had meant to avoid, so R1's split between the two
  kinds repeats that first look from two more places; it is not an independent
  check.
- **The places and times.** The owner's machine (macOS, Node 25.9.0), on
  16 Nov 2026 from 21:31 UTC. Cloudflare's network, through a scratch Worker
  the owner deployed and deleted, on 16 Nov 2026 from 21:51 UTC; the Worker
  made each request and timed it, and the owner's machine only relayed one
  post at a time.
- **The command.** `pnpm -C prototypes/instagram measure <sample>` here, and the
  same with `--via <Worker address>` for Cloudflare.
- **Gentle on Instagram.** One request at a time, 5 seconds between any two, each
  post read once per route per run. A route stopped for the rest of a run after
  3 rate limits or login redirects in a row.
- **The same request from both places.** Every request sent the `User-Agent`
  `paste-and-taste-instagram-spike/1 (+https://github.com/julian-palomo/paste-and-taste)`,
  which names no browser. No cookie, token or login was used, and nothing
  imitated a browser.
- **A time** covers the request, any redirect and the whole answer.
- **What counts.** "Caption" means the post's data held a non-empty caption;
  "video address" means it held an address for the video file. No video was
  downloaded, so whether those addresses work is not measured.

## R1: the public embed view

`https://www.instagram.com/p/<code>/embed/captioned/`, the page Instagram
serves for embedding a post on another site.

**What it needs.** Nothing.

**What it returns.** It is not documented. The page carries the post's data as
JSON inside a script: the caption, whether it is a video, and for some reels
the video's address.

| Kind | Place | Posts | OK | Caption | Video address | Median | Worst |
| ---- | ----- | ----- | -- | ------- | ------------- | ------ | ----- |
| Reel, own audio | Owner's machine | 10 | 10 | 10/10 | 10/10 | 660 ms | 885 ms |
| Reel, own audio | Cloudflare | 10 | 10 | 10/10 | 10/10 | 463 ms | 813 ms |
| Reel, licensed music | Owner's machine | 8 | 8 | 8/8 | 2/8 | 609 ms | 1000 ms |
| Reel, licensed music | Cloudflare | 8 | 8 | 8/8 | 2/8 | 559 ms | 1299 ms |
| Unknown | Owner's machine | 1 | 1 | 1/1 | 0/1 | 579 ms | 579 ms |
| Unknown | Cloudflare | 1 | 1 | 1/1 | 0/1 | 416 ms | 416 ms |

**How it fails.** It didn't, for a public post, in either place. For the private
post it answered 200 with a page saying the post may be broken, in both places,
which the script counts as `not-found`. The same posts gave the same answers in
both places.

**What the terms say.** The route isn't an API, so no developer terms describe
it; the general rules below apply.

## R2: oEmbed, with no access token

`https://graph.facebook.com/v27.0/instagram_oembed?url=<post address>`, Meta's
documented endpoint for embedding a post.

**What it needs.** Nothing since 15 May 2026, when Meta's changelog says it
can be called without an access token. Before, it needed a Meta app with the
"Meta oEmbed Read" feature. The oEmbed reference page still shows an access
token in its example; a call without one answered 200 in both places.

**What it returns.** By its documentation: `version`, `provider_name`,
`provider_url`, `type`, `width` and `html`, the embed's markup, with the caption
included unless `hidecaption` is set. `author_name` and `thumbnail_url` were
removed from the answer on 3 Nov 2025. In this sample the `html` held no
caption: its only text was the "View this post on Instagram" link. It never
holds a video address or images.

| Kind | Place | Posts | OK | Caption | Video address | Median | Worst |
| ---- | ----- | ----- | -- | ------- | ------------- | ------ | ----- |
| Reel, own audio | Owner's machine | 10 | 10 | 0/10 | 0/10 | 331 ms | 687 ms |
| Reel, own audio | Cloudflare | 10 | 10 | 0/10 | 0/10 | 223 ms | 556 ms |
| Reel, licensed music | Owner's machine | 8 | 8 | 0/8 | 0/8 | 419 ms | 592 ms |
| Reel, licensed music | Cloudflare | 8 | 8 | 0/8 | 0/8 | 172 ms | 455 ms |
| Unknown | Owner's machine | 1 | 1 | 0/1 | 0/1 | 645 ms | 645 ms |
| Unknown | Cloudflare | 1 | 1 | 0/1 | 0/1 | 231 ms | 231 ms |

**How it fails.** The private post got 400 with `error_subcode` 2207046,
"Private Media", in both places. Nothing else failed.

**What the terms say.** Its page, [Embed an Instagram Post](https://developers.facebook.com/documentation/instagram-platform/oembed)
(read 16 Nov 2026), says the endpoint is only for embedding content in
websites and apps, and that using its metadata or content for any other
purpose than a front-end view is strictly prohibited, naming extracting and
persisting it. Private, age-restricted and embed-disabled accounts and Stories
are not supported. The limit is 1,000 requests an hour.

## R3: the post's own page

`https://www.instagram.com/p/<code>/`, the page a browser opens for the post.

**What it needs.** Nothing.

**What it returns.** It is not documented. yt-dlp's extractor reads a post
from JSON in this page's scripts when its other routes fail. In this sample
the page held the post's code only in its route parameters, never the post's
data, from either place.

| Kind | Place | Posts | OK | Caption | Video address | Median | Worst | Failures |
| ---- | ----- | ----- | -- | ------- | ------------- | ------ | ----- | -------- |
| Reel, own audio | Owner's machine | 10 | 0 | 0/10 | 0/10 | 439 ms | 846 ms | missing data, 200 ×10 |
| Reel, own audio | Cloudflare | 10 | 0 | 0/10 | 0/10 | 450 ms | 575 ms | login redirect, 302 ×2; missing data, 200 ×3; stopped ×5 |
| Reel, licensed music | Owner's machine | 8 | 0 | 0/8 | 0/8 | 491 ms | 529 ms | missing data, 200 ×8 |
| Reel, licensed music | Cloudflare | 8 | 0 | 0/8 | 0/8 | 148 ms | 161 ms | login redirect, 302 ×3; stopped ×5 |
| Unknown | Owner's machine | 1 | 0 | 0/1 | 0/1 | 446 ms | 446 ms | missing data, 200 ×1 |
| Unknown | Cloudflare | 1 | 0 | 0/1 | 0/1 | - | - | stopped ×1 |

**How it fails.** From the owner's machine it answered 200 every time, without
the post's data. From Cloudflare, 5 of the 8 answers before the route stopped
were a 302 to the login page, the first on the first post; the route stopped
after three in a row (posts 6 to 8), and the 11 posts left were not read.

**What the terms say.** As for R1: the general rules below.

## Routes described and not tried

- **R4, the logged-out GraphQL query** that Instagram's web page itself calls
  (`POST https://www.instagram.com/api/graphql`). In
  [yt-dlp's extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py)
  it takes three requests: the page for one token, a second endpoint for a
  cookie, then the query with the web app's id and both tokens, and yt-dlp
  only sends it when it can imitate a browser's TLS. That replays the web
  app's session rather than reading a public link, so the owner ruled it out.
  Its `doc_id` is hardcoded in yt-dlp; that it can change without notice is an
  inference from it being internal.
- **Business Discovery** ([docs](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery),
  read 16 Nov 2026). Needs a Meta app and the access token of the caller's own
  professional account: a login. It looks up another professional account by
  username, not a post by its link, and returns no data for age-gated
  accounts. Since 30 Jul 2026 `media_url` is left out for video with licensed
  audio and for reels whose owner turned off downloads.
- **The IG Media endpoints** of the Instagram API with Instagram Login. They
  read only the media of the account that logged in.
- **The Basic Display API.** Meta's changelog says it was removed on
  4 Dec 2024, and every request to it returns an error.
- **`i.instagram.com/api/v1/media/<id>/info/`**, which yt-dlp only calls when
  logged in.
- **Paid scraping services.** They need an account and payment, and they scrape
  for their customer, under the same terms as below.
- **Asking Meta for written permission**, which the terms below name as the
  condition for automated collection. Not explored.

## What Meta's terms say about every route

Read on 16 Nov 2026. A reading, not legal advice.

- [Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms),
  effective 7 Oct 2024: no automated data collection from Meta's products
  without Meta's express written permission.
- [Instagram's robots.txt](https://www.instagram.com/robots.txt): its notice
  says collection by automated means is prohibited without Instagram's express
  written permission, and it disallows every path to any crawler not named.
- [Instagram's Terms of Use](https://help.instagram.com/581066165581870), the
  English (UK) version, which shows no revision date: among what a user can't
  do is accessing or collecting information in an automated way without
  express permission, "regardless of whether such automated access or
  collection is undertaken while logged in". This text was read by the
  owner's cloud session in a headless browser; the local session couldn't
  render the page.

So every route measured here that returns a caption or a video is automated
collection that these terms forbid without Meta's permission, with or without
a login, and R2's own page forbids using its answer for anything but showing
the embed.

## What was not tried or is not known

- **Carousels and single images.** None in the sample, so the requirement to
  read a carousel's images has no figure at all.
- **Whether the video addresses work.** None was downloaded, from either place,
  and how long an address stays valid is not known.
- **More than one run per place.** One run each, on one evening. Posts 1 and 2
  were also read twice more from the owner's machine in dry runs before the
  measured run, and post 1 twice more through oEmbed while checking where its
  caption would be.
- **Volume.** At one request every 5 seconds, no route was rate-limited. What
  happens at the rate a real app would need is not known.
- **What the captions hold.** Whether a caption holds a whole recipe was read
  by the reviewer on a first look at this sample on 16 Nov 2026, not measured
  here: a whole recipe in 7 of 19 posts, ingredients alone in 5, a method in
  prose in 1, and no recipe in 6.
- **The page's meta tags.** R3 was read for the JSON in its scripts only, not
  for the description in its `<meta>` tags.
- **The two posts of unknown kind.** Their kind stays unknown; one is private.
- **Why oEmbed's `html` holds no caption**, when its documentation says the
  caption is included unless `hidecaption` is set. A call with an app's access
  token, or with other parameters, was not tried. In the answers looked at, the
  `blockquote` has no `data-instgrm-captioned` attribute; that this is why the
  caption is missing is a guess, not something checked.
