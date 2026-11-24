# The AI provider and the SDK for the import

- **Status:** Proposed
- **Date:** 2026-11-24

## Context

The import turns what an Instagram post gives into a recipe that can be kept
and edited: from its caption, and from its video when the post's recipe is
spoken or shown ([`product.md`](../product.md)). It runs in the background, in
Cloudflare Workflows ([the record](2026-11-15-cloudflare-workflows.md)), and
reads a post through its public embed view
([the proposed record](2026-11-16-how-an-instagram-post-is-read.md)).

A spike compared three candidates on 20 of the owner's posts, from the owner's
machine, on 17 and 18 Nov 2026, each with the same instructions and recipe
schema, and the owner marked every answer blind. The figures are in
[`docs/research/instagram-to-recipe.md`](../research/instagram-to-recipe.md).
In short:

- **A, Gemini Flash reading the video itself** in one call: 20 of 20 valid,
  13 good, 3 fixable, 4 wrong; on the 10 recipe posts with a video, 8 good and
  none wrong. Median 15 s and 0.008 USD a post.
- **B, Whisper and Llama 4 Scout on Workers AI**: 18 of 20 valid, 5 good,
  7 fixable, 8 wrong; 3 of its 21 calls failed on the network, and on Workers
  Free it doesn't fit 20 posts in a day. Median 46 s and 0.0015 USD a post.
- **C, the same Whisper transcript and Claude Haiku**: 20 of 20 valid, 7 good,
  9 fixable, 4 wrong; on the 10 recipe posts with a video, 4 good and none
  wrong. Median 11 s and 0.0016 USD a post.

8 of the 20 posts gave no video address, so every candidate read only their
caption; no candidate read frames. The sample has no carousel.

## Decision

Proposed: the import writes a recipe with **Gemini Flash, reading the video
itself**, called with **Google's own SDK** (`@google/genai`) from a Workflow
step, with the recipe schema as structured output. A post with no video address
is read from its caption alone.

Recommended because it scored best where the candidates read the same thing,
it needs no extraction step, and it runs whole inside a Workflow step. The
owner decides it.

## Alternatives considered

- **C, Claude Haiku with a Whisper transcript.** Cheapest per post and fastest,
  with no answer wrong on the recipe posts with a video, but fewer of them good
  (4 of 10 against 8). It needs two providers, and its frames and audio have to
  be extracted outside a Worker, in a Container or with Media Transformations,
  which wasn't tried. A larger Claude model wasn't tried; the owner keeps it as
  a second run if Haiku falls short.
- **B, everything on Workers AI.** One provider, already the app's, with zero
  data retention; but the lowest quality, 3 network failures in 21 calls, 2 of
  them at about 60 seconds for a cause not known, and the same extraction
  problem as C. On Workers Free its daily allocation stopped it.
- **OpenAI.** Its transcription and general models were priced, not run.
- **The provider-neutral AI SDK** (`ai`, by Vercel, with a package per
  provider, and Cloudflare's `createAI` for Workers AI). One interface for any
  provider, so changing provider is a configuration change. It wasn't run: the
  spike counted tokens as each provider reports them, which its own SDK returns
  unchanged, and Gemini's usage splits video, audio and thinking tokens. With
  one provider, the second interface buys little yet.

## Consequences

- **Google becomes a provider of the app.** A paid Gemini API key, as a
  server-side secret: on the free tier Google uses the inputs to improve its
  products, and these are other people's posts. On the paid tier the inputs
  are not used for that, and are logged for a limited period to detect abuse.
- **Cost.** About 0.008 USD a post at the median and 0.023 at the worst, at
  this month's price. Google's pricing page doubles it from 1 Jan 2027.
- **Changing provider means rewriting one module.** The SDK is Google's, so the
  module that calls it is too. The recipe schema, the instructions and the
  checks stay.
- **Zero to several items per post.** A post can hold tips, which the app saves
  too, or several recipes in one video; the schema here holds one recipe. The
  import has to return zero to several items per post, each a recipe or a tip.
- **What the embed view doesn't give stays out of reach.** A post with no video
  address is read from its caption. A recipe that is only shown, in a reel with
  someone else's music, can't be read that way.
- **Still to measure before building on it.** Carousels; a reel's frames; the
  video addresses from inside a Workflow; and more than one run.
