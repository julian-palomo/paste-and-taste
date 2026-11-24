# Instagram prototype

Throwaway code for two spikes. `measure` checks which ways of reading a public
Instagram link return a post's caption, its video address and its carousel
images, with no login. `recipe` has AI candidates turn what a post gives into a
recipe, with its time and cost counted, and `marks` counts the owner's blind
marks of the answers. Nothing in `apps/` or `packages/` imports it, and it is
deleted when the real import replaces it. What stays are the reports,
[`instagram-reading.md`](../../docs/research/instagram-reading.md) and
[`instagram-to-recipe.md`](../../docs/research/instagram-to-recipe.md), and
their records in [`docs/adr/`](../../docs/adr/README.md).

It is exempt from "test first" (`AGENTS.md`, section 2).

## The sample

The list of posts is the owner's and stays outside the repo: its path is the
script's argument, and nothing the script prints holds a link, a handle or a
caption. One post per line, with its kind:

```text
# blank lines and lines starting with # are skipped
<link> reel-own-audio
<link> reel-music
<link> image
<link> carousel <number of images>
<link> unknown
```

`unknown` is a post the owner couldn't sort; its totals get a row of their
own. A line may end with where the post's recipe is, which `recipe` reports by:
`caption`, `speech`, `frames`, `carousel` or `nowhere`. A post is named by its
line number in the file, so commenting a line out keeps the others' numbers.

## Running it

```bash
pnpm -C prototypes/instagram measure /absolute/path/to/sample.txt
```

`pnpm -C` runs the script from this folder, so the path must be absolute. It
reads each post once per route (the embed view, oEmbed with no token and the
post's page), one request at a time with 5 seconds between requests, and
stops a route after 3 rate limits or login redirects in a row. Every request
sends the same `User-Agent`, which the output prints.

## From a post to a recipe

```bash
pnpm -C prototypes/instagram recipe /absolute/path/to/sample.txt --candidates A,B,C --out /absolute/folder [--budget 10]
pnpm -C prototypes/instagram combine /absolute/folder /absolute/folder/run-… [/absolute/folder/run-…]
pnpm -C prototypes/instagram marks /absolute/folder/<run or combined folder>
```

The candidates are A (Gemini reads the video), B (Whisper and Llama 4 Scout on
Workers AI) and C (Whisper and Claude). Their keys come from the shell:
`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. `--out` must be outside the repo: each run writes a
folder there with the answers, its printed output and a blind marks sheet, and
`ledger.json` adds up every paid call of every run, stopping before a call that
would pass `--budget`. The media live in a temporary folder removed after each
post. `combine` builds one blind sheet from several runs, the last run winning
for a post and candidate; `marks` reads the filled sheet with its key.

## Running it from Cloudflare's network

The scratch Worker, `src/worker.ts`, measures one route for one post per
request, with the same code. The script on the owner's machine stays the only
loop and sends it one post at a time, so the sample never reaches Cloudflare.
Until `RUN_TOKEN` is set, the Worker answers every request with 401.

Only the owner runs these; an agent never deploys:

```bash
pnpm -C prototypes/instagram exec wrangler deploy                 # prints the workers.dev address
pnpm -C prototypes/instagram exec wrangler secret put RUN_TOKEN   # asks for the value
RUN_TOKEN=<the same value> pnpm -C prototypes/instagram measure /absolute/path/to/sample.txt --via https://<address>
pnpm -C prototypes/instagram exec wrangler delete
```

`pnpm -C prototypes/instagram worker:bundle` bundles the Worker without
writing anything to Cloudflare.
