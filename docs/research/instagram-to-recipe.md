# From what an Instagram post gives to a recipe

A spike's report: for the owner's sample, which steps and which AI provider
turn what a post gives (its caption, its video) into a structured recipe, with
the quality the owner marked, the time and the cost per post counted. The code
is throwaway, in [`prototypes/instagram`](../../prototypes/instagram/README.md);
this report stays. The decision it informs is proposed in
[`docs/adr/2026-11-24-the-ai-provider-and-sdk.md`](../adr/2026-11-24-the-ai-provider-and-sdk.md).

Every figure is a measurement unless it says it is an estimate. Docs name a
model without its version number; the exact model ids are in the pull request
and in `prototypes/instagram/src/prices.ts`.

## How it was measured

- **The sample.** The owner's 21 posts: the 20 of
  [the reading report](instagram-reading.md), plus one added on 17 Nov 2026.
  All are reels. Post 19 is private and can't be read, so 20 posts ran. The
  sample has **no carousel and no single image**: the carousel path is
  untested, and the reading report never measured reading a carousel through
  the embed view either.
- **Where the recipe is.** The owner watched every post and marked one place
  per post: `caption` when the caption alone holds the whole recipe, otherwise
  where the steps are, `speech` before `frames`. Of the 20 that ran: caption 9,
  speech 7, frames 4. Post 15 was first marked `nowhere` and corrected to
  `frames` after the runs: it holds a recipe that is only shown, with music and
  no speech or text. The runs' own output still says `nowhere` for it.
- **What a candidate got.** Each post was read through the public embed view,
  the route the reading report recommends. 8 of the 20 posts gave no video
  address, so every candidate got their caption alone. **That includes all 4
  `frames` posts (8, 12, 13 and 15): reading frames was tested by no
  candidate.**
- **The same instructions and schema for all.** One prompt, word for word, and
  one JSON Schema: a title, the post's language, servings and time when stated,
  ingredients with quantity and unit when the post gives them, and the steps in
  order; or no recipe. An answer that doesn't parse or doesn't validate is a
  failure.
- **Marked blind.** The owner marked each answer good, fixable or wrong without
  knowing which candidate wrote it: the sheet named candidates by a letter
  shuffled per post, and only the counting joined it to its key.
- **Counted, not assumed.** Tokens and audio seconds are what each provider's
  response reported; the cost is computed from the published prices read on
  16 and 17 Nov 2026, so on a free allocation it is what the usage would cost,
  not a bill.
- **The runs**, all from the owner's machine (macOS, Node 25.9.0), with one
  ledger for the whole issue:
  - dry runs on posts 1 and 2: candidate A on 17 Nov 2026 at 11:12 UTC, B and
    C at 11:22 UTC;
  - **run 1**: A, B and C on the 20 posts, 17 Nov 2026 from 12:51 UTC;
  - run 2: B and C on posts 14 to 21, 18 Nov 2026 at 11:38 UTC, which Workers
    AI refused (see "Candidate B and the Workers Free plan");
  - **run 3**: B and C on posts 14 to 21, 18 Nov 2026 from 12:09 UTC;
  - a retry of B's two failed calls of run 3, 18 Nov 2026 at 12:22 UTC, which
    Workers AI refused too.

  The figures below take A from run 1, and B and C from run 1 for posts 1 to
  13 and from run 3 for posts 14 to 21.

## Results

Where each figure comes from:

- **Marks**: the owner's sheet and its key.
- **Costs**: the ledger the runs wrote, which holds every paid call.
- **Times and tokens**: each run's printed output. Run 3's is in the file it
  wrote. Run 1's file was lost; its output survives only in the session's
  transcript, copied from there. Each of its 54 costs matches the ledger.

| Candidate | Posts | Valid | Good | Fixable | Wrong | Median time | Worst time | Median cost | Worst cost | Spent |
| --------- | ----- | ----- | ---- | ------- | ----- | ----------- | ---------- | ----------- | ---------- | ----- |
| A, Gemini | 20 | 20 | 13 | 3 | 4 | 15.1 s | 51.0 s | 0.0080 USD | 0.0225 USD | 0.170 USD |
| B, all on Cloudflare | 20 | 18 | 5 | 7 | 8 | 45.5 s | 80.4 s | 0.0015 USD | 0.0205 USD | 0.132 USD |
| C, Claude | 20 | 20 | 7 | 9 | 4 | 10.8 s | 31.9 s | 0.0016 USD | 0.0061 USD | 0.049 USD |

B's 2 invalid answers are two calls that failed (see below), marked wrong.
A time is the whole chain for a post: reading it, downloading, and for B and C
extracting and transcribing. B's and C's cost includes the shared transcript.

**The whole issue spent 0.39 USD** of its 10 USD budget, by the ledger: the dry
runs, the four runs and the retry. Three one-token calls made by hand to read
Workers AI's error aren't in it.

**Per place**, the owner's marks:

| Candidate | Caption (9) | Speech (7) | Frames (4) |
| --------- | ----------- | ---------- | ---------- |
| A | 6 good, 2 fixable, 1 wrong | 5 good, 1 fixable, 1 wrong | 2 good, 2 wrong |
| B | 3 good, 3 fixable, 3 wrong | 3 fixable, 4 wrong | 2 good, 1 fixable, 1 wrong |
| C | 3 good, 5 fixable, 1 wrong | 3 good, 3 fixable, 1 wrong | 1 good, 1 fixable, 2 wrong |

**Reliability at the first attempt.** Of the calls that reached a model, A lost
none of 20, C none of 23, and B 3 of 21 to a network error: post 14 in run 1
and two posts in run 3. Calls Workers AI refused for its daily allocation are
not counted here.

### The recipe posts with a video

The 10 posts with a recipe and a video address (2, 4, 5, 7, 10, 14, 16, 17, 18
and 20) are where the candidates read the same thing and differ most:

| Candidate | Good | Fixable | Wrong |
| --------- | ---- | ------- | ----- |
| A | 8 | 2 | 0 |
| B | 1 | 5 | 4 |
| C | 4 | 6 | 0 |

B's 4 wrong include its 2 failed calls.

### Posts reported apart

- **Posts 3 and 9 are tips.** Post 3 holds tips and no recipe: all three
  candidates answered "no recipe", which was all the schema allowed, and the
  owner marked all three wrong because the app saves tips too. That mark is
  about the schema, not the candidates. Post 9 gives tips while making a
  gazpacho: A and C wrote the recipe and were marked good; B was marked wrong.
- **The 8 posts with no video address** (1, 6, 8, 11, 12, 13, 15 and 21): every
  candidate got the caption alone. A: 4 good, 1 fixable, 3 wrong. B: 4, 2 and 2.
  C: 2, 3 and 3. Post 15 holds a recipe that is only shown, with music and no
  speech or text. With no video address, all three answered "no recipe", and
  the owner marked all three wrong: the recipe is lost, through no fault of
  the candidates.

### What the owner's notes say

Written in the sheet with the marks, summed up here without the posts' content:

- **Missing ingredients or quantities**: in 15 fixable answers: A 2, B 6, C 7.
- **The time** of the recipe, caught or missed: noted on 5 answers.
- **Language**: two of B's answers (posts 16 and 17) were written partly or
  wholly in English for Spanish posts, though their `language` field was right.
- **Terse steps that are hard to follow**: three of B's answers and one of C's.
- **Post 17** compares three ways of making a broth. C kept them apart, and the
  owner judged its answer the best of the three, fixable.

## Candidate B and the Workers Free plan

Workers AI's free allocation is 10,000 Neurons a day, reset at 00:00 UTC; above
it the account needs Workers Paid
([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), read
17 Nov 2026). The account used here is on Workers Free.

- **The arithmetic.** Cloudflare counts 24,545 Neurons per million input
  tokens and 77,273 per million output tokens for Llama 4 Scout, and 46.63 per
  audio minute for Whisper. At those rates, B's reported usage adds up to about
  9,050 Neurons by post 13 of run 1, dry run included. A frame costs Scout about
  2,300 tokens, so a 129-second reel with 30 frames costs about 1,800 Neurons.
  One pass over the 20 posts needs roughly 13,000 to 14,000 Neurons, an
  estimate from the 13 posts B finished in run 1: **B doesn't fit in one day on
  Workers Free.**
- **What the runs hit.** From post 15 of run 1, every Workers AI call answered
  429 with code 4006 and the message "you have used up your daily free
  allocation of 10,000 neurons". Cloudflare's
  [error list](https://developers.cloudflare.com/workers-ai/platform/errors/)
  gives code 3036 for that message. Whisper failed too, so C wrote posts 16, 17,
  18 and 20 of run 1 without a transcript; run 3 repeats them with one. Run 2,
  at 11:38 UTC on 18 Nov, got the same 429 on every call, though the
  allocation should have reset at 00:00 UTC. What used it up that day is not
  known. A call at 12:09 UTC answered 200, and run 3 went through. The retry of
  B's two failed calls of run 3 got the 429 again at 12:22 UTC, so those two
  stay failures, as agreed before the retry.
- **The failures at about 60 seconds.** On post 14 of run 1, Scout's call ran
  for 564 seconds and failed with a network error (`TypeError`), reporting no
  usage. In run 3, two of Scout's calls failed the same way at 60.3 and 60.7
  seconds, while its successful calls in that run took up to 58.7 seconds.
  Their cause is not known: the label didn't keep the error's cause then, and
  the retry never reached the model. The usage of the failed calls isn't in the
  sum above.

## What can run on Workers, per step

From the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
the [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
and [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/),
read 16 and 17 Nov 2026. On Workers Paid, a Workflow step gets 30 s of CPU
(configurable to 5 min), 128 MB of memory, no wall-clock limit while waiting on
the network, a 1 MiB result, and 10,000 subrequests. On Workers Free a step gets
10 ms of CPU and 50 subrequests, so the answers below are for Paid.

| Step | Inside a Worker or Workflow step? | What decides it |
| ---- | --------------------------------- | --------------- |
| Read the post | Yes | Waiting on the network |
| Download the video | Yes, up to the memory | The video is held in 128 MB |
| Call a model (A; B's and C's writer) | Yes | Waiting on the network; Workers AI is also a binding |
| Transcribe (B, C) | Yes | A Workers AI call |
| Extract audio and frames (B, C) | **No**, not with `ffmpeg` | A native binary needs a process, and `node:child_process` is a "non-functional stub" on Workers |

What Cloudflare offers instead for the extraction:

- **[Media Transformations](https://developers.cloudflare.com/stream/transform-videos/)**
  (read 17 Nov 2026): `mode=frame` gives a still at a timestamp,
  `mode=spritesheet` several frames in one JPEG, and `mode=audio` an AAC M4A.
  Input under 100 MB and at most 10 minutes, MP4 with H.264. It is called by URL
  on a zone with Transformations enabled, and the source's origin must answer
  HEAD and range requests with `Content-Range`. Whether Instagram's video
  addresses meet that is not documented and was not tried. A frame counts as one
  transformation, audio one per second of output.
- **[Containers](https://developers.cloudflare.com/containers/)**
  ([limits](https://developers.cloudflare.com/containers/platform/limits/), read
  17 Nov 2026), on Workers Paid only: any container image, so `ffmpeg` runs
  there, from 1/16 vCPU and 256 MiB up to 4 vCPU, 12 GiB and 20 GB of disk.

So candidate A runs whole on Workers; B and C need Media Transformations or a
Container for their extraction.

## What each provider does with the inputs

Read on 16 and 17 Nov 2026. A reading for the owner, not legal advice. These are
other people's posts.

| Provider | Trains on the inputs | How long it keeps them | Source |
| -------- | -------------------- | ---------------------- | ------ |
| Gemini, paid tier | No: "Google doesn't use your prompts … or responses to improve our products" | Logged "for a limited period of time" to detect abuse; no length stated | [Gemini API terms](https://aistudio.google.com/docs/terms), modified 23 Mar 2026 |
| Gemini, free tier | Yes, and human reviewers may read them | — | same page; the runs used a paid key |
| Anthropic API | No, by default; only feedback or an explicit opt-in | Deleted within 30 days; up to 2 years when the usage policy is broken | [training](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training), 18 Aug 2026; [retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), 1 Jul 2026 |
| Workers AI | No | Zero retention for standard inference; operational metadata only | [data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/), 16 Oct 2026 |

## What was not tried

- **Carousels and single images.** None in the sample.
- **Reading frames.** The 4 `frames` posts gave no video address, so no
  candidate saw a frame of them.
- **Several items per post.** The schema holds one recipe. Post 19, which can't
  be read, holds three recipes in one video; posts 3 and 9 are tips. A shape
  with zero to several items per post, each typed `recipe` or `tip`, was not
  tried.
- **OpenAI.** Described, not run: its transcription costs from 0.003 USD a
  minute (`gpt-4o-mini-transcribe`) to 0.006, and whether its general models
  take images was not checked
  ([pricing](https://developers.openai.com/api/docs/pricing), read 16 Nov 2026).
- **A larger Claude model.** C ran on Haiku only; the owner asks for a larger
  model only if Haiku falls short.
- **B on Workers Paid**, where the daily allocation wouldn't stop it, and the
  cause of its failures at about 60 seconds.
- **The provider-neutral SDK in code.** The prototype used each provider's own
  SDK; the AI SDK is compared in the record from its documentation.
- **Media Transformations and Containers**, described above, not run.
- **More than one measured run per candidate, and other days.**
