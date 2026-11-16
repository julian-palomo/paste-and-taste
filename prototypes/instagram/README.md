# Instagram reading prototype

Throwaway code for a spike: it measures which ways of reading a public
Instagram link return a post's caption, its video address and its carousel
images, with no login. Nothing in `apps/` or `packages/` imports it, and it is
deleted when the real import replaces it. What stays is the report,
[`docs/research/instagram-reading.md`](../../docs/research/instagram-reading.md),
and its record in [`docs/adr/`](../../docs/adr/README.md).

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
```

A post is named by its line number in the file.

## Running it

```bash
pnpm -C prototypes/instagram measure /absolute/path/to/sample.txt
```

`pnpm -C` runs the script from this folder, so the path must be absolute. It
reads each post once per route (the embed view, oEmbed with no token and the
post's page), one request at a time with 5 seconds between requests, and
stops a route after 3 rate limits or login redirects in a row. Every request
sends the same `User-Agent`, which the output prints.

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
